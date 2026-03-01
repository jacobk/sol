# TICKET-010: File Inspector

**Related:** ADR 001, ADR 005, PRD 001 Section 3.5
**Feature:** [File Inspector](../features/file-inspector.md)
**Status:** Changes Requested
**Created:** 2026-03-01

## Context to Load

1. `docs/ADR/001-tech-stack.md` - Shiki, marked, diff2html library choices
2. `docs/ADR/005-pi-rpc-integration.md` - Notes that file browsing is direct fs/child_process, not RPC
3. `docs/PRD/001-sol.md` Section 3.5 - File inspector requirements
4. `docs/features/file-inspector.md` - Feature overview

## Implementation Checklist

### 1. Create file inspection backend module

Create `src/files.ts`:
- `getGitStatus(cwd: string)` — runs `git status --porcelain` via `child_process`, parses output into structured file list (path, status: modified/added/untracked/deleted)
- `getFileContent(cwd: string, filePath: string)` — reads file via `fs.readFile`, with path validation to prevent directory traversal
- `getGitDiff(cwd: string, filePath: string)` — runs `git diff` via `child_process`, returns raw diff text

### 2. Add file API endpoints

Add to `src/server.ts`:
- `GET /api/files/:id` — resolves session ID to cwd, returns git status file list
- `GET /api/files/:id/content?path=<file>` — returns file contents
- `GET /api/files/:id/diff?path=<file>` — returns git diff

### 3. Build file list component

Create `frontend/src/components/FileList.tsx` — displays git working tree changes grouped by status (modified, added, untracked). Each file row shows path and status badge. Tapping opens file detail view.

### 4. Build file content viewer

Create `frontend/src/components/FileViewer.tsx`:
- Syntax highlighting via Shiki (lazy-loaded grammars for bundle size)
- Horizontal scrolling for code (never wrap lines)
- For `.md` files: toggle between rendered markdown (via marked) and raw source
- Code typography from TICKET-003

### 5. Build diff viewer

Create `frontend/src/components/DiffViewer.tsx`:
- Renders git diffs using diff2html in line-by-line mode (not side-by-side — too narrow on mobile)
- Styled to match dark theme

### 6. Integrate with session detail

Add a "Files" tab or button in SessionDetail header that navigates to the file inspector for that session's working directory.

## Maintainability

- [ ] **Modularity** — File operations isolated in `src/files.ts`, completely independent of session/RPC logic
- [ ] **DRY check** — Shiki instance should be shared/cached (grammar loading is expensive)
- [ ] **Debt impact** — Path validation in `getFileContent` is security-critical; invest in thorough implementation

**Specific refactoring tasks:** None — new module. Ensure Shiki lazy loading is configured once at the app level, not per-component.

## Testing Requirements

### Verification Checklist

```bash
npm run build  # Must pass
# Get a session ID that has a git repo as cwd:
curl http://localhost:8081/api/files/<id> | jq .
curl 'http://localhost:8081/api/files/<id>/content?path=README.md'
```

## Acceptance Criteria

- [ ] `/api/files/:id` returns git working tree changes for the session's cwd
- [ ] `/api/files/:id/content?path=<file>` returns file contents (with path traversal protection)
- [ ] `/api/files/:id/diff?path=<file>` returns git diff
- [ ] File list displays files grouped by status
- [ ] Code files render with syntax highlighting (Shiki) and horizontal scrolling
- [ ] Markdown files support rendered/raw toggle
- [ ] Diffs render in line-by-line mode via diff2html
- [ ] Returns 404 for sessions with no git repo

## Files to Modify

| File | Change |
|------|--------|
| NEW: `src/files.ts` | Git status, file content, and diff functions |
| MODIFY: `src/server.ts` | Add `/api/files/:id`, `/api/files/:id/content`, `/api/files/:id/diff` routes |
| NEW: `frontend/src/components/FileList.tsx` | File list grouped by status |
| NEW: `frontend/src/components/FileViewer.tsx` | Syntax highlighted file viewer with markdown toggle |
| NEW: `frontend/src/components/DiffViewer.tsx` | Line-by-line diff viewer |
| MODIFY: `frontend/src/components/SessionDetail.tsx` | Add files navigation |

---

## Review Feedback (2026-03-01)

**Result:** ❌ Changes Requested

### What's Complete

All functional requirements from the ticket are implemented correctly:
- Backend module `src/files.ts` with proper path validation
- Three API endpoints in `src/app.ts`
- Frontend components (FileList, FileViewer, DiffViewer)
- SessionDetail integration with "📁 Files" button
- Shiki syntax highlighting with lazy loading
- diff2html in line-by-line mode
- Markdown rendered/raw toggle with `.markdown-prose` styling

ADR alignment verified (ADR 001 for libraries, ADR 005 for fs-based file access).

### Required Changes: Add Tests

Per PRD 3.9 and Constitution Rule 10:

1. **Create `src/files.test.ts`** with unit tests for:
   - `getGitStatus()` — parsing various porcelain output scenarios, handling non-git directories (returns null)
   - `validateFilePath()` — path traversal attempts (`../`, absolute paths), valid relative paths
   - `getFileContent()` — successful reads, path validation rejection (returns null)
   - `getGitDiff()` — staged vs unstaged diffs, non-git repo handling

2. **Add API tests to `src/app.test.ts`** for:
   - `GET /api/files/:id` — 404 for unknown session, 404 for non-git cwd, success with file list
   - `GET /api/files/:id/content` — 400 missing path param, 403 path traversal, 404 file not found, success
   - `GET /api/files/:id/diff` — 400 missing path param, 404 for non-git repo, success with diff

The path validation (`validateFilePath`) is specifically called out as security-critical in the Maintainability section — test coverage is mandatory.
