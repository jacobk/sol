# Prompt Input & Streaming Output

## Overview

Provides the core interaction loop for active sessions: a mobile-optimized text input for sending prompts to pi, and real-time streaming display of the agent's response. Prompts are sent via pi RPC commands (`prompt`, `steer`, `follow_up`), and streaming output is delivered from the RPC subprocess through Sol's SSE bridge to the browser.

## User Stories

From [PRD 001](../PRD/001-sol.md) Section 2.2:
- "As a developer, I want to send prompts to the active session with a mobile-friendly input so I can direct the agent from my phone."
- "As a developer, I want to see streaming agent responses in real-time so I know what the agent is doing as it works."
- "As a developer, I want to expand and collapse tool calls so I can focus on the conversational flow without clutter."

## Implementation

> **Note:** This section is completed by the implementation agent.

### Key Files

| File | Purpose |
|------|---------|
| `src/server.ts` | `/api/session/:id/prompt`, `/api/session/:id/steer`, `/api/session/:id/abort` endpoints |
| `frontend/src/components/PromptInput.tsx` | Auto-resizing textarea with send/abort controls |
| `frontend/src/components/StreamingMessage.tsx` | Incrementally rendered assistant response |

### Data Flow

1. User types in `PromptInput` → sends POST to `/api/session/:id/prompt` (or `/steer`, `/abort`)
2. Express route calls `sendCommand()` from `src/rpc.ts` → writes JSON to pi subprocess stdin
3. Pi subprocess emits `message_update`, `tool_execution_*` events on stdout as JSON lines
4. SSE route (`/api/session/:id/stream`) forwards events to browser via `EventSource`
5. `StreamingMessageContainer` receives SSE events → incrementally updates DOM via `StreamingMessageBubble`
6. Tool executions rendered as compact `ToolExecutionIndicator` components (collapsed by default, expandable)

### Key Functions

- `src/app.ts`: `POST /api/session/:id/prompt`, `POST /api/session/:id/steer`, `POST /api/session/:id/abort` — thin wrappers around `sendCommand()`
- `PromptInput.tsx`: Auto-resizing textarea with send/abort toggle, long-press for delivery mode selection (prompt/steer/follow_up)
- `StreamingMessageContainer`: Connects to SSE, parses events, manages streaming message and tool execution state
- `StreamingMessageBubble`: Incremental DOM text append for <50ms perceived latency

## Rationale

### Design Decisions

- **Auto-resizing textarea:** The input grows as the user types, up to a maximum height, then scrolls internally. This is more mobile-friendly than a fixed-height input that requires scrolling for longer prompts.
- **iOS keyboard optimization:** The input supports autocorrect and dictation (no `autocomplete="off"` or `spellcheck="false"`), since dictation is a primary input method on mobile.
- **Three delivery modes:** `prompt` for new user messages, `steer` for mid-generation guidance, `follow_up` for continuing after completion. These map directly to pi RPC commands.
- **Abort button replaces send during streaming:** While the agent is generating, the send button transforms into an abort button. This prevents accidental double-sends and provides a clear way to stop generation.
- **Tool calls collapsed by default:** During streaming, tool execution events (`tool_execution_start/update/end`) are shown as compact status indicators. They can be expanded after completion to see full details. This keeps the streaming view focused on the conversational response.
- **<50ms perceived latency target:** Tokens are rendered as they arrive from the SSE stream. The frontend appends to the DOM incrementally rather than re-rendering the full message on each token.

### ADR References

- [ADR 005: Pi RPC Integration](../ADR/005-pi-rpc-integration.md) - `prompt`, `steer`, `follow_up`, `abort` commands and `message_update` events
- [ADR 001: Tech Stack](../ADR/001-tech-stack.md) - SSE choice, Preact signals for efficient streaming updates

## Current Limitations

1. No rich input (no markdown preview, no file attachment — inline `@` completions deferred to Mobile Composer feature).
2. No offline queuing — if the RPC subprocess is not connected, prompts fail immediately.

## Related Features

- [Mobile Composer](mobile-composer.md) - Full-screen prompt editor with template insertion, file completion, and history recall. Addresses limitations #1 and #2 above with a dedicated composition experience.
