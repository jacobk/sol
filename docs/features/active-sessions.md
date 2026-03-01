# Active Sessions (Pi RPC Integration)

## Overview

Sol can connect to pi sessions as an active frontend by spawning `pi --mode rpc` subprocesses. This enables sending prompts, receiving streaming output, switching models, aborting operations, and handling extension UI dialogs — all from an iPhone over Tailscale. Sol manages the lifecycle of these subprocesses, translating between HTTP/SSE (browser) and pi's JSON stdin/stdout protocol.

This is the foundational layer that enables prompt input, streaming output, model switching, and all other active session features.

## User Stories

From [PRD 001](../PRD/001-sol.md) Section 2.1:
- "As a developer, I want to connect to an active pi session so I can continue working on it from my phone."

From [PRD 001](../PRD/001-sol.md) Section 2.2:
- "As a developer, I want to send prompts to the active session with a mobile-friendly input so I can direct the agent from my phone."
- "As a developer, I want to see streaming agent responses in real-time so I know what the agent is doing as it works."

## Implementation

> **Note:** This section is completed by the implementation agent.

### Key Files

| File | Purpose |
|------|---------|
| `src/rpc.ts` | RPC subprocess manager (spawn, communicate, cleanup) |
| `src/app.ts` | `/api/session/:id/connect`, `/api/session/:id/stream` (SSE), `/api/session/:id/state` endpoints |
| `src/server.ts` | Server startup and graceful shutdown (kills all RPC subprocesses on SIGTERM/SIGINT) |

### Data Flow

```
Browser (POST /connect) → Express → spawnRpc() → pi --mode rpc subprocess
Browser (GET /stream)   → Express → SSE connection ← onEvent() ← subprocess stdout (JSON lines)
Browser (GET /state)    → Express → sendCommand({type:"get_state"}) → subprocess stdin
                                  ← onEvent() listener ← subprocess stdout → JSON response
```

1. User connects: `POST /api/session/:id/connect` looks up session via SDK, spawns `pi --mode rpc --session-dir <path>` with session's `cwd`.
2. SSE stream: `GET /api/session/:id/stream` registers an event listener on the subprocess. JSON lines from stdout are forwarded as SSE `data:` frames.
3. State query: `GET /api/session/:id/state` sends `get_state` command to stdin, waits for response event, returns it as JSON.
4. Cleanup: Client disconnect removes listener. If no listeners remain, an idle timer (10 min) starts. On timeout or server shutdown, subprocess is killed (abort + SIGTERM).

### Key Functions

| Function | File | Description |
|----------|------|-------------|
| `spawnRpc(sessionId, sessionDir, cwd)` | `src/rpc.ts` | Spawns `pi --mode rpc` subprocess, sets up stdout JSON line parsing, tracks in Map |
| `sendCommand(sessionId, command)` | `src/rpc.ts` | Writes JSON + newline to subprocess stdin |
| `onEvent(sessionId, callback)` | `src/rpc.ts` | Registers listener for parsed JSON events from stdout |
| `offEvent(sessionId, callback)` | `src/rpc.ts` | Removes listener, starts idle timer if none remain |
| `killRpc(sessionId)` | `src/rpc.ts` | Sends abort command, then SIGTERM after 100ms |
| `killAllRpc()` | `src/rpc.ts` | Terminates all active subprocesses (server shutdown) |
| `isConnected(sessionId)` | `src/rpc.ts` | Checks if subprocess is active for session |
| `findSessionById(id)` | `src/sessions.ts` | Looks up SessionInfo by UUID via SDK |

## Rationale

### Design Decisions

- **One subprocess per active session:** Each `pi --mode rpc` process is scoped to a single session directory. This provides process isolation — a crashing pi subprocess doesn't take down Sol or other sessions.
- **SSE for browser streaming:** Server-Sent Events are used instead of WebSockets because SSE is simpler, natively supported by browsers (`EventSource` API), and sufficient for the unidirectional event stream from pi → browser. Browser → Sol commands use regular HTTP POST.
- **Lazy subprocess spawning:** Sol does not pre-spawn RPC processes. A subprocess is created when the user explicitly connects to a session, and cleaned up on disconnect or timeout. This keeps idle memory usage low.
- **Sol never writes session files:** All session persistence is handled by pi via the RPC subprocess. Sol is a pure proxy/translator between the browser and pi.

### ADR References

- [ADR 005: Pi RPC Integration](../ADR/005-pi-rpc-integration.md) - Full architecture, command table, and process lifecycle
- [ADR 003: Standalone Server Architecture](../ADR/003-standalone-server-architecture.md) - Why Sol runs standalone (required for RPC subprocess management)

## Current Limitations

1. Memory overhead of ~50-100MB per active pi subprocess.
2. ~1-2s startup latency when first connecting to a session (pi initialization).
3. No automatic reconnection if the RPC subprocess crashes — user must reconnect manually.
4. No multiplexing — each browser tab connecting to the same session would need its own subprocess (or shared subprocess with fan-out, not yet designed).
