# ADR 003: Standalone Server Architecture

**Date:** 2026-02-28
**Updated:** 2026-03-01
**Status:** Accepted
**Supersedes:** N/A

## Context

Three integration approaches were considered for serving Sol:

1. **Standalone server** — separate Node.js process on port 8081, independent of pi.
2. **Pi extension** — run inside pi as an extension. Only works while a pi session is active.
3. **Hybrid** — extension spawns a detached background server that persists after pi exits.

Sol must support two modes: browsing historical sessions (which must work even when pi is not running) and interacting with active sessions via `pi --mode rpc` subprocesses (see [ADR 005](005-pi-rpc-integration.md)). The extension approach fails the first requirement — pi extensions only run inside an active pi session.

## Decision

We will use Option 1 — a standalone Node.js server on port 8081.

### Deployment

- Run manually: `npm start` or `tsx src/server.ts`
- Run in tmux: `tmux new-session -d -s sol 'cd ~/Code/personal/sol && npm start'`
- Optional: launchd plist for auto-start on macOS login (documented but not required)

### Port Selection

Port 8081 was chosen to avoid conflicts with common development servers. It is the only port Sol uses.

## Consequences

### Positive

- Works without pi running — browse historical sessions anytime
- Active session interaction via spawned `pi --mode rpc` subprocesses (see [ADR 005](005-pi-rpc-integration.md))
- Simple deployment — one process, one port
- No coupling to pi's extension lifecycle
- Can be managed independently (start, stop, restart)

### Negative

- Separate process to manage (mitigated by tmux or launchd)
- Active sessions require spawning `pi --mode rpc` subprocesses, adding memory overhead (~50-100MB per active session)

### Technical

- Express server binds to `0.0.0.0:8081` for Tailscale access
- Static files served from `public/`
- Historical browsing is stateless — reads session files from disk via the SDK
- Active sessions are stateful — Sol manages `pi --mode rpc` subprocess lifecycles

### Maintainability

- Sol is a self-contained application with no dependency on other projects
- Clear internal separation: SDK for historical reading, RPC subprocesses for active interaction
- Can be developed and deployed independently of pi itself
