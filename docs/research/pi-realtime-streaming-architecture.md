# Research: Pi Architecture — Real-Time Session Streaming Options

**Date:** 2026-03-01
**Context:** TICKET-009 (Prompt Input and Streaming Output)
**Question:** What approaches does pi's architecture support for real-time multi-client session streaming?

## Pi's Integration Levels

Pi provides three levels of integration for Node.js applications:

### 1. `SessionManager` (Read-Only SDK)

What Sol uses today for historical session data.

- `SessionManager.open(path)` reads the JSONL file once and parses all entries
- `SessionManager.listAll()` discovers sessions across all project directories
- **No watch/subscribe capability** — one-shot read only
- Cannot detect new entries appended by another process

### 2. `pi --mode rpc` Subprocess / `RpcClient`

What Sol currently uses for active sessions.

- Spawns a **separate pi process** with its own `AgentSession`
- Communicates via stdin (JSON commands) / stdout (JSON events + responses)
- `RpcClient` (`dist/modes/rpc/rpc-client.js`) is a typed TypeScript wrapper
- **Key limitation:** Each subprocess is independent. It loads the session file on startup but does NOT watch for changes made by other pi processes. It only streams events from its own work.
- **Concurrent write risk:** Two pi processes writing to the same JSONL via `appendFileSync` could interleave. There's no file lock — `appendFileSync` is atomic at the OS level for reasonable line sizes, but pi wasn't designed for concurrent writers.

### 3. `createAgentSession()` (In-Process SDK)

The most powerful option, recommended by pi's own docs.

> "If you're building a Node.js application, consider using `AgentSession` directly from `@mariozechner/pi-coding-agent` instead of spawning a subprocess."
> — `docs/rpc.md`

- Creates an `AgentSession` directly in Sol's Node.js process — no subprocess needed
- Full access to `session.subscribe()` for real-time events
- Full access to `session.prompt()`, `session.steer()`, `session.abort()`, etc.
- Can open an existing session: `SessionManager.open(path)`
- Gets the same event types as RPC mode (same `AgentSession` class powers both)
- **Same limitation for multi-process:** still can't see what a different pi process is doing

Key SDK entry point:

```typescript
import { createAgentSession, SessionManager } from "@mariozechner/pi-coding-agent";

const { session } = await createAgentSession({
  sessionManager: SessionManager.open("/path/to/session.jsonl"),
});

session.subscribe((event) => {
  // Real-time events: agent_start, message_update, tool_execution_*, agent_end, etc.
});

await session.prompt("Hello!");
```

## The Core Problem: No Cross-Process Event Bus

Pi has no built-in mechanism for one process to subscribe to another process's events. Each `AgentSession` (whether in-process or subprocess) is isolated:

```
Terminal pi ──→ its own AgentSession ──→ writes to session.jsonl
Sol's pi   ──→ its own AgentSession ──→ writes to session.jsonl (SAME FILE)
```

Both write to the same JSONL file via `appendFileSync`, but neither watches for the other's writes. The JSONL file is the **only shared state** between pi processes.

## Session File Format

Sessions are stored as append-only JSONL files at `~/.pi/agent/sessions/<encoded-cwd>/`. Each line is a JSON object:

```jsonl
{"type":"session","version":3,"id":"...","timestamp":"...","cwd":"/path/to/project"}
{"type":"model_change","id":"...","parentId":null,"timestamp":"...","provider":"anthropic","modelId":"claude-opus-4.6"}
{"type":"thinking_level_change","id":"...","parentId":"...","timestamp":"...","thinkingLevel":"medium"}
{"type":"message","id":"...","parentId":"...","timestamp":"...","message":{"role":"user","content":[...]}}
{"type":"message","id":"...","parentId":"...","timestamp":"...","message":{"role":"assistant","content":[...],...}}
```

Entries have `id` and `parentId` forming a tree structure (for branching). The file is append-only — entries are never modified or deleted. Persistence is via `appendFileSync` in `SessionManager._persist()`.

## All Possible Approaches

| Approach | Real-time? | See terminal pi? | Send prompts? | Complexity | Memory |
|----------|-----------|------------------|---------------|------------|--------|
| **A. File watching only** | ~1s latency | ✅ Yes | ❌ No | Low | Low |
| **B. In-process `AgentSession` only** | Instant (events) | ❌ Own events only | ✅ Yes | Medium | Medium |
| **C. `RpcClient` (typed subprocess)** | Instant (events) | ❌ Own events only | ✅ Yes | Medium | High (~50-100MB/session) |
| **D. Hybrid: File watch + in-process SDK** | ~1s for terminal, instant for Sol | ✅ Yes | ✅ Yes | Medium | Medium |
| **E. Hybrid: File watch + RPC subprocess** | ~1s for terminal, instant for Sol | ✅ Yes | ✅ Yes | Medium | High |
| **F. SDK polling (`SessionManager.open` in loop)** | ~3s latency | ✅ Yes | Needs separate | Low | Low but wasteful |

### Approach A: File Watching Only (Monitor Mode)

- Watch the JSONL file with `fs.watch()` + polling fallback
- Read new bytes when file size increases, parse as JSONL lines
- Forward new entries to SSE clients
- **Pro:** Sees ALL activity from any pi process. Zero subprocess overhead.
- **Con:** No way to send prompts, steer, or abort. Read-only monitoring.
- **Con:** ~1s latency (poll interval). `fs.watch` can be unreliable on some systems.
- **Con:** Entries arrive as complete session entries, not streaming deltas (no token-by-token).

### Approach B: In-Process `AgentSession`

- Use `createAgentSession({ sessionManager: SessionManager.open(path) })` directly in Sol
- Subscribe to events, send prompts via `session.prompt()`
- **Pro:** Instant streaming with full delta events. Typed API. No subprocess.
- **Con:** Cannot see what terminal pi is doing (isolated `AgentSession`)
- **Con:** Agent runs in Sol's process — crashes/hangs could affect Sol
- **Con:** Each session loads extensions, tools, models (~2-5s startup)

### Approach C: `RpcClient` (Typed Subprocess Wrapper)

- Pi provides `RpcClient` class that wraps `pi --mode rpc` with typed methods
- `client.onEvent()` for streaming, `client.prompt()` / `client.steer()` / `client.abort()`
- **Pro:** Typed API, process isolation (subprocess crash doesn't kill Sol)
- **Con:** Same as raw RPC — can't see terminal pi. ~50-100MB per subprocess.
- **Note:** Sol currently uses raw subprocess spawning; `RpcClient` would be cleaner.

### Approach D: Hybrid File Watch + In-Process SDK ⭐ Recommended

- **File watcher** for monitoring: Detects new entries from any pi process
- **In-process `AgentSession`** for interaction: `session.prompt()`, `session.subscribe()`
- **Pro:** Best of both worlds. Sees terminal pi (~1s). Instant streaming for Sol prompts. No subprocess.
- **Pro:** Lower memory than RPC subprocess approach
- **Pro:** Richer API — direct access to `session.getSessionStats()`, `session.cycleModel()`, etc.
- **Con:** Agent in Sol's process — needs error boundaries
- **Con:** Two writers to same JSONL (terminal pi + Sol's session) — concurrent write risk

### Approach E: Hybrid File Watch + RPC Subprocess (Current Implementation)

- **File watcher** for monitoring (detects entries from any pi process)
- **RPC subprocess** for interaction (prompt/steer/abort via stdin/stdout)
- **Pro:** Process isolation — subprocess crash doesn't affect Sol
- **Pro:** Sees terminal pi via file watcher
- **Con:** Higher memory (~50-100MB per subprocess)
- **Con:** Orphan process management needed
- **Con:** Untyped JSON protocol (vs direct SDK calls)

### Approach F: SDK Polling

- Periodically call `SessionManager.open(path)` and diff against previous state
- **Pro:** Simple, uses existing SDK
- **Con:** Reopens and reparses entire file each time — wasteful for large sessions
- **Con:** ~3s latency typical, higher for large files
- **Con:** No streaming deltas — only complete entries

## Hard Constraints

These cannot be changed regardless of approach:

1. **You cannot attach to a running terminal pi process.** Pi has no network/IPC server mode. No socket, no shared memory, no message queue.

2. **The JSONL file is the only shared state.** File watching is the only way to observe another pi process's activity.

3. **Two pi processes should not write to the same session simultaneously.** `appendFileSync` is line-atomic on most OSes for small writes, but pi wasn't designed for concurrent writers. Interleaved writes could produce malformed JSONL or tree structure inconsistencies.

4. **File-watched entries are complete, not streaming.** When observing via file watch, you see the final `message` entry after the assistant finishes — not the incremental `text_delta` / `thinking_delta` events. Token-by-token streaming is only available from the process that owns the `AgentSession`.

## Recommendation

**Approach D (File Watch + In-Process SDK)** is the best fit for Sol:

1. Replace the RPC subprocess with `createAgentSession()` for sending prompts
2. Keep the file watcher for observing terminal pi activity
3. Use `session.subscribe()` for real-time streaming from Sol-initiated prompts
4. Use the file watcher for entries written by terminal pi

This eliminates subprocess management complexity, reduces memory usage, provides a typed API, and follows pi's own recommendation for Node.js integrations. The main risk (agent running in-process) can be mitigated with proper error handling.

### Migration Path

1. Replace `src/rpc.ts` (subprocess management) with in-process SDK wrapper
2. Keep `src/session-watcher.ts` (file watching) as-is
3. Use `RpcClient` as an intermediate step if process isolation is preferred
4. Merge SSE stream: file watcher entries + `session.subscribe()` events

## Source References

- `node_modules/@mariozechner/pi-coding-agent/docs/rpc.md` — RPC protocol documentation
- `node_modules/@mariozechner/pi-coding-agent/dist/core/sdk.js` — `createAgentSession()` implementation
- `node_modules/@mariozechner/pi-coding-agent/dist/core/agent-session.d.ts` — `AgentSession` API
- `node_modules/@mariozechner/pi-coding-agent/dist/core/session-manager.d.ts` — `SessionManager` API
- `node_modules/@mariozechner/pi-coding-agent/dist/modes/rpc/rpc-client.js` — `RpcClient` implementation
- `node_modules/@mariozechner/pi-coding-agent/dist/modes/rpc/rpc-mode.js` — RPC mode (how events flow)
- `node_modules/@mariozechner/pi-coding-agent/examples/sdk/` — SDK usage examples
