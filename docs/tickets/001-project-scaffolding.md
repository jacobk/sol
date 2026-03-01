# TICKET-001: Project Scaffolding (Express + Vite + Preact)

**Related:** ADR 001, ADR 003, PRD 001 Section 3.9
**Feature:** All (foundation)
**Status:** Changes Requested
**Created:** 2026-03-01

## Context to Load

1. `docs/ADR/001-tech-stack.md` - Stack decisions (Express + tsx backend, Preact + Vite frontend)
2. `docs/ADR/003-standalone-server-architecture.md` - Port 8081, bind 0.0.0.0
3. `docs/PRD/001-sol.md` Section 3.9 - API endpoint table
4. `docs/PRD/001-sol.md` Section 4.4 - Technology requirements

## Implementation Checklist

### 1. Set up Express backend

`src/server.ts` — Express app listening on port 8081, bound to `0.0.0.0`. Add `GET /api/health` returning `{ ok: true }`. Export the app separately from the `listen()` call so the app is importable without starting the server. Ensure `npm run dev` starts with `tsx watch`.

### 2. Set up Vite + Preact frontend

Initialize `frontend/` directory with Vite and Preact. Structure:
```
frontend/
  src/
    main.tsx          → Preact entry point
    components/       → Component directory (empty scaffold)
  index.html          → Vite HTML entry
  vite.config.ts      → Proxy /api/* to Express on 8081
```

Configure Vite dev server to proxy `/api/*` to `http://localhost:8081` for local development.

### 3. Configure Tailwind CSS v4

Install Tailwind CSS v4. Create the global stylesheet with initial `@theme` block for CSS variable tokens (placeholder values — TICKET-003 will define the full design system). Verify Tailwind processes classes in Preact `.tsx` files.

### 4. Configure production build

`vite build` outputs to a directory (e.g., `dist/`) that Express serves as static files in production. Add npm scripts:
- `npm run dev` — starts Express via `tsx watch` (backend only)
- `npm run dev:frontend` — starts Vite dev server with HMR
- `npm run build:frontend` — `vite build` for production
- `npm run build` — `tsc --noEmit` for type checking

### 5. Verify dev workflow

Ensure the full dev loop works: Vite dev server on port 5173 proxies API to Express on 8081. HMR works for Preact components. `tsc --noEmit` passes.

## Maintainability

- [ ] **Modularity** — Server setup exports the Express app separately from `listen()` for testability
- [ ] **DRY check** — N/A (greenfield)

**Specific refactoring tasks:** None — greenfield.

## Testing Requirements

### Verification Checklist

```bash
npm run build                              # tsc --noEmit must pass
npm run dev                                # Express starts on 8081
curl http://localhost:8081/api/health      # Returns {"ok":true}
npm run build:frontend                     # Vite build succeeds
```

## Acceptance Criteria

- [ ] Express server starts on port 8081, bound to `0.0.0.0`
- [ ] `GET /api/health` returns `{ ok: true }`
- [ ] Vite dev server starts and proxies `/api/*` to Express
- [ ] Preact renders a placeholder page via Vite
- [ ] Tailwind CSS v4 processes utility classes in `.tsx` files
- [ ] `vite build` produces static output servable by Express
- [ ] `tsc --noEmit` passes with zero type errors
- [ ] Server accessible from other devices on the network

## Files to Modify

| File | Change |
|------|--------|
| `src/server.ts` | Express server entry point with health endpoint and static file serving |
| NEW: `frontend/index.html` | Vite HTML entry point |
| NEW: `frontend/src/main.tsx` | Preact app entry point |
| NEW: `frontend/src/app.tsx` | Root Preact component (placeholder) |
| NEW: `frontend/src/index.css` | Global stylesheet with Tailwind v4 `@theme` block |
| NEW: `frontend/vite.config.ts` | Vite config with API proxy and Preact plugin |
| MODIFY: `package.json` | Add frontend dependencies and scripts |
| MODIFY: `tsconfig.json` | Ensure frontend sources are included for type checking |

## Review Feedback (2026-03-01)

**Reviewer decision: Changes Requested**

The implementation is solid overall — type checks pass, builds succeed, architecture matches ADRs. Four issues must be resolved:

### Issue 1: Missing `.gitkeep` in `frontend/src/components/` (Blocker)
The ticket explicitly requires a `components/` directory scaffold. The directory exists on disk but git won't track it. **Fix:** Add `frontend/src/components/.gitkeep`.

### Issue 2: `app.tsx` should be `App.tsx` (Blocker)
Per AGENTS.md naming convention: "`PascalCase.tsx` for Preact components." The file exports the `App` component and should be named `App.tsx`. Update the filename and the import in `main.tsx`.

### Issue 3: ADR `public/` vs `frontend/dist/` discrepancy (Blocker)
ADR 001 and ADR 003 both reference `public/` as the static file serving directory. The implementation uses `frontend/dist/`, which is a better approach but contradicts the ADRs. **Fix:** Update ADR 001 and ADR 003 to say `frontend/dist/` instead of `public/`.

### Issue 4: Unwarranted AGENTS.md addition (Blocker)
A "Manual Server Verification" section was added to AGENTS.md. This is not specified in the ticket and violates Constitution rule 3 (No Unwarranted Side Effects). **Fix:** Either remove the addition, or if it's considered valuable, create a separate ticket/commit for it and remove it from this changeset.
