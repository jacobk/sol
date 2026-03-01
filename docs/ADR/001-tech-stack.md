# ADR 001: Tech Stack

**Date:** 2026-02-28
**Status:** Accepted
**Supersedes:** N/A

## Context

We need a mobile-first web application that serves as a full remote frontend to pi (pi.dev). The app must support streaming chat, code viewing with syntax highlighting, markdown rendering, git diffs, and interactive session management. Primary target is iPhone Safari over Tailscale VPN.

## Decision

### Backend

- **Node.js + TypeScript** — same runtime as pi, no context switching
- **Express** — minimal HTTP framework for REST + SSE endpoints
- **tsx** — run TypeScript directly without compilation during development
- **`pi --mode rpc`** — subprocess-based integration for active session interaction (see [ADR 005](005-pi-rpc-integration.md))
- **`SessionManager` SDK** — session discovery and historical reading (see [ADR 002](002-session-discovery-via-sdk.md))

### Frontend

- **Preact** — React-compatible at 4KB; signals for efficient streaming updates
- **Tailwind CSS v4 + Headless UI** — utility-first styling with accessible component primitives
- **Vite** — build tool with HMR (works over Tailscale to iPhone for live dev)
- **Shiki** — VS Code-quality syntax highlighting with lazy grammar loading
- **marked** — lightweight markdown rendering with GFM support
- **diff2html** — git diff rendering in line-by-line mobile mode
- **SSE (Server-Sent Events)** — native browser API for streaming pi RPC events to client

See [Frontend Technology Prestudy](../prestudy-frontend-technology.md) for detailed comparison and rationale.

### Project Structure

```
src/server.ts          → Express server, run via tsx (no build)
frontend/              → Preact SPA, built by Vite
  src/
    main.tsx
    components/
  index.html
```

Vite dev server proxies `/api/*` to Express on 8081. Production: `vite build` outputs to `frontend/dist/`, Express serves statically.

## Consequences

### Positive

- Preact gives a real component model at near-vanilla bundle size (~4KB)
- Full React ecosystem access (syntax highlighters, headless UI) via `preact/compat`
- Vite HMR enables live reload directly on iPhone during development
- SSE is zero-cost client-side (native `EventSource` API)
- `tsx` means no build step for backend during development

### Negative

- Vite adds a frontend build step (absent in the original vanilla approach)
- Preact's `compat` layer has occasional edge cases with newer React features (irrelevant for this SPA)

### Technical

- Backend: `tsx src/server.ts` — no compilation needed
- Frontend dev: `vite dev` on port 5173, proxies API to 8081
- Frontend prod: `vite build` → static files served by Express
- `tsc --noEmit` for type checking only

### Maintainability

- Single language (TypeScript) across backend and frontend
- Preact ecosystem means most React tutorials and patterns apply
- If UI complexity outgrows Preact, migration to React is mechanical (swap imports)
- Tailwind v4 CSS-first config means no JS config files to maintain
