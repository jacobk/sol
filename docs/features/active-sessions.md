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
| `src/server.ts` | `/api/session/:id/connect`, `/api/session/:id/stream` (SSE), and RPC proxy endpoints |

### Data Flow

{To be filled during implementation.}

### Key Functions

{To be filled during implementation.}

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
