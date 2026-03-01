# File Inspector

## Overview

Displays files modified or created by the pi agent during a session. Shows git working tree changes (modified, added, untracked files), full file contents with syntax highlighting, markdown rendering with raw toggle, and git diffs in a mobile-friendly line-by-line format. All file operations are scoped to the session's working directory (`cwd`).

## User Stories

From [PRD 001](../PRD/001-sol.md) Section 2.4:
- "As a developer, I want to see files the agent has modified or created (git working tree changes) so I can review its work."
- "As a developer, I want to view full file contents with syntax highlighting so I can read agent-generated code on my phone."
- "As a developer, I want to view markdown files with a toggle between rendered and raw so I can read documentation the agent wrote."
- "As a developer, I want to view git diffs for modified files so I can understand what changed."

## Implementation

> **Note:** This section is completed by the implementation agent.

### Key Files

| File | Purpose |
|------|---------|
| `src/files.ts` | Git status parsing, file reading, diff generation |
| `src/server.ts` | `/api/files/:id`, `/api/files/:id/content`, `/api/files/:id/diff` endpoints |
| `frontend/src/components/FileInspector.tsx` | File list and detail views |

### Data Flow

1. User taps "📁 Files" in `SessionDetail` header → navigates to `FileList` view
2. `FileList` fetches `GET /api/files/:id` → Express resolves session cwd via `findSessionById()`, runs `getGitStatus(cwd)` which executes `git status --porcelain`, returns parsed file list
3. User taps a file → navigates to `FileViewer` which fetches `GET /api/files/:id/content?path=<file>` → Express reads file via `getFileContent(cwd, path)` with path traversal protection
4. User taps "Diff" → navigates to `DiffViewer` which fetches `GET /api/files/:id/diff?path=<file>` → Express runs `getGitDiff(cwd, path)` via `git diff`

### Key Functions

- `getGitStatus(cwd)` — Runs `git status --porcelain`, parses output into `GitFileStatus[]` (path + status)
- `getFileContent(cwd, filePath)` — Validates path against directory traversal, reads file via `fs.readFile`
- `getGitDiff(cwd, filePath)` — Runs `git diff --cached` and `git diff` for staged+unstaged changes; falls back to `git diff --no-index` for untracked files
- `validateFilePath(cwd, filePath)` — Security function ensuring resolved path stays within cwd

## Rationale

### Design Decisions

- **Git-based file discovery:** Uses `git status` and `git diff` via `child_process` rather than filesystem scanning. This surfaces exactly what the agent changed, not the entire project tree.
- **Direct `fs` reads for content:** File contents are read directly from disk rather than going through pi RPC, since Sol has filesystem access and this avoids unnecessary subprocess overhead for read-only operations.
- **Shiki for syntax highlighting:** VS Code-quality highlighting with lazy grammar loading keeps the initial bundle small while supporting all common languages.
- **diff2html in line-by-line mode:** Side-by-side diffs don't fit on a 390px iPhone screen. Line-by-line mode stacks old/new lines vertically, which works well on mobile.
- **Markdown toggle:** Rendered markdown is the default for `.md` files, with a tap to switch to raw source. Developers reviewing agent-written docs need both views. The rendered view uses a custom `.markdown-prose` stylesheet (`index.css`) that maps all typographic elements (headings, lists, blockquotes, code, tables, links, horizontal rules) to the project's design tokens for consistent dark-theme readability.
- **Tailwind Typography plugin:** `@tailwindcss/typography` is installed as a dependency, but prose styling is handled via the hand-tuned `.markdown-prose` class for precise control over the OLED dark theme. The Typography plugin remains available for any future prose needs elsewhere.

### ADR References

- [ADR 001: Tech Stack](../ADR/001-tech-stack.md) - Shiki, marked, diff2html library choices
- [ADR 005: Pi RPC Integration](../ADR/005-pi-rpc-integration.md) - Notes that file browsing is NOT via RPC (direct fs/child_process)

## Current Limitations

1. Only shows git working tree changes — untracked files outside git are not surfaced.
2. No file tree browser for the full project (listed as future consideration in PRD).
3. Binary files (images, compiled assets) are not rendered — only a placeholder is shown.
4. Large files (>1MB) may be slow to syntax-highlight on the client.
