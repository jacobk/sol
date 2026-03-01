# ADR 005: Pi RPC Integration for Active Sessions

**Date:** 2026-02-28
**Status:** Accepted
**Supersedes:** N/A

## Context

Sol needs to interact with active pi sessions: send prompts, receive streaming output, switch models, abort operations, and handle extension UI dialogs. The initial architecture assumed Sol would read JSONL files and use `sendUserMessage()` via the extension API. This is insufficient — Sol runs as a standalone server, not as a pi extension.

Pi provides an RPC mode (`pi --mode rpc`) that exposes the full agent lifecycle over a JSON protocol on stdin/stdout. This is purpose-built for embedding pi in other applications.

## Decision

We will use pi's RPC mode as the integration layer for all active session interaction.

### Architecture

```
iPhone Safari ←──HTTP/SSE──→ Sol (Express) ←──stdin/stdout JSON──→ pi --mode rpc
```

Sol manages one or more `pi --mode rpc` subprocess(es). The Express server translates between HTTP/SSE (browser) and the JSON stdin/stdout protocol (pi).

### RPC Commands Used

| Sol Feature | RPC Command | Direction |
|-------------|-------------|-----------|
| Send prompt | `prompt` | Sol → pi |
| Steer agent | `steer` | Sol → pi |
| Follow-up | `follow_up` | Sol → pi |
| Streaming output | `message_update` events | pi → Sol → SSE |
| Tool execution | `tool_execution_*` events | pi → Sol → SSE |
| Get messages | `get_messages` | Sol → pi |
| Session state | `get_state` | Sol → pi |
| Switch model | `set_model` | Sol → pi |
| List models | `get_available_models` | Sol → pi |
| Abort | `abort` | Sol → pi |
| List commands | `get_commands` | Sol → pi |
| Compact | `compact` | Sol → pi |
| Fork | `fork` | Sol → pi |
| Switch session | `switch_session` | Sol → pi |
| New session | `new_session` | Sol → pi |
| Extension UI | `extension_ui_request/response` | Bidirectional |

### Process Management

Sol spawns `pi --mode rpc` per active session, with the working directory set to the session's `cwd`. The subprocess lifecycle:

1. User selects a session in Sol → Sol spawns `pi --mode rpc --session-dir <path>` with appropriate cwd
2. Sol reads JSON events from stdout, forwards to browser via SSE
3. Sol receives HTTP requests from browser, writes JSON commands to stdin
4. On disconnect or timeout, Sol sends abort and terminates the subprocess

### What RPC Does NOT Cover

- **Session discovery/listing**: RPC is per-session. Listing all sessions across projects requires `SessionManager.listAll()` (ADR 002).
- **File browsing**: Git status and file contents are read directly by Sol's Express server using `child_process` and `fs`, scoped to the session's `cwd`.

## Consequences

### Positive

- Full pi feature parity — every RPC command maps to a pi capability
- Streaming is native — `message_update` events arrive as JSON lines, trivially forwarded via SSE
- Extension UI protocol means Sol can handle extension dialogs (confirm, select, input)
- Process isolation — a crashing pi subprocess doesn't take down Sol
- Session persistence handled by pi — Sol doesn't write to JSONL files

### Negative

- One subprocess per active session — memory overhead (~50-100MB per pi process)
- Subprocess lifecycle management adds complexity (spawn, health check, cleanup)
- Latency of subprocess startup on first connect (~1-2s for pi to initialize)

### Technical

- Use Node.js `child_process.spawn()` with `{ stdio: ['pipe', 'pipe', 'pipe'] }`
- Read stdout line-by-line (each line is a JSON event)
- Write to stdin with `\n` delimiter
- Handle process exit, SIGTERM, and error events for cleanup

### Maintainability

- Clear separation: Sol never writes session data, pi owns the session file
- RPC protocol is documented and versioned by pi
- If pi adds new RPC commands, Sol can adopt them incrementally
