# TICKET-008: RPC Process Management

**Related:** ADR 005, ADR 003, PRD 001 Section 3.3, 3.4
**Feature:** [Active Sessions (RPC)](../features/active-sessions.md)
**Status:** Ready for Implementation (depends on TICKET-001, TICKET-002)
**Created:** 2026-03-01

## Context to Load

1. `docs/ADR/005-pi-rpc-integration.md` - Full RPC architecture, command table, process lifecycle
2. `docs/ADR/003-standalone-server-architecture.md` - Standalone server with RPC subprocesses
3. `docs/PRD/001-sol.md` Section 3.3, 3.4 - Prompt input and streaming output requirements
4. `docs/features/active-sessions.md` - Feature overview

## Implementation Checklist

### 1. Create RPC subprocess manager

Create `src/rpc.ts` — manages `pi --mode rpc` subprocess lifecycle:
- `spawnRpc(sessionDir: string, cwd: string)` — spawns a `pi --mode rpc --session-dir <path>` subprocess with the session's working directory
- `sendCommand(sessionId: string, command: object)` — writes JSON + newline to subprocess stdin
- `onEvent(sessionId: string, callback)` — registers a listener for JSON events from subprocess stdout
- `killRpc(sessionId: string)` — sends abort, then terminates the subprocess
- Track active subprocesses by session ID in a `Map`

### 2. Add POST /api/session/:id/connect endpoint

Spawn an RPC subprocess for the given session. Return success/error. If already connected, return existing connection status.

### 3. Add GET /api/session/:id/stream SSE endpoint

Open an SSE connection. Forward all JSON events from the RPC subprocess stdout to the browser as SSE `data:` frames. Handle subprocess exit by closing the SSE stream. Handle client disconnect by cleaning up the subprocess.

### 4. Add GET /api/session/:id/state endpoint

Send `get_state` RPC command and return the result (current model, streaming status, etc.).

### 5. Handle subprocess lifecycle

Implement cleanup for: subprocess crashes (emit error event on SSE, remove from map), server shutdown (SIGTERM all active subprocesses), client disconnect (timeout then kill), and idle timeout (kill subprocesses with no SSE listeners after N minutes).

## Maintainability

- [ ] **Modularity** — All RPC logic in `src/rpc.ts`, Express routes are thin proxies
- [ ] **DRY check** — Command sending pattern should be generic (one function for all RPC commands)
- [ ] **Debt impact** — Subprocess lifecycle management is complex; invest in proper error handling and logging upfront

**Specific refactoring tasks:** Design `src/rpc.ts` API to be command-agnostic so TICKET-009 (prompt/streaming) and TICKET-011 (model switching) only need to call `sendCommand()` with different payloads.

## Testing Requirements

### Verification Checklist

```bash
npm run build  # Must pass
# Start server, then:
curl -X POST http://localhost:8081/api/session/<id>/connect  # Spawns RPC subprocess
curl http://localhost:8081/api/session/<id>/state | jq .      # Returns session state
```

## Acceptance Criteria

- [ ] `POST /api/session/:id/connect` spawns a `pi --mode rpc` subprocess
- [ ] `GET /api/session/:id/stream` opens an SSE connection forwarding RPC events
- [ ] `GET /api/session/:id/state` returns current session state
- [ ] Subprocess crash is handled gracefully (SSE error event, cleanup)
- [ ] Client disconnect triggers subprocess cleanup (with timeout)
- [ ] Multiple connect calls to the same session reuse the existing subprocess
- [ ] Server shutdown terminates all active subprocesses

## Files to Modify

| File | Change |
|------|--------|
| NEW: `src/rpc.ts` | RPC subprocess manager |
| MODIFY: `src/server.ts` | Add `/api/session/:id/connect`, `/api/session/:id/stream`, `/api/session/:id/state` routes |
