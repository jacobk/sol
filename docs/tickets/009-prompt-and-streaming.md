# TICKET-009: Prompt Input and Streaming Output

**Related:** ADR 005, ADR 001, PRD 001 Section 3.3, 3.4
**Feature:** [Prompt Input & Streaming](../features/prompt-and-streaming.md)
**Status:** Completed
**Created:** 2026-03-01

## Context to Load

1. `docs/ADR/005-pi-rpc-integration.md` - `prompt`, `steer`, `follow_up`, `abort` RPC commands and `message_update` events
2. `docs/ADR/001-tech-stack.md` - SSE choice, Preact signals for streaming
3. `docs/PRD/001-sol.md` Section 3.3 - Prompt input requirements
4. `docs/PRD/001-sol.md` Section 3.4 - Streaming output requirements
5. `docs/features/prompt-and-streaming.md` - Feature overview
6. `src/rpc.ts` - RPC subprocess manager (from TICKET-008)

## Implementation Checklist

### 1. Add prompt/steer/abort API endpoints

Add to `src/server.ts`:
- `POST /api/session/:id/prompt` — sends `prompt` RPC command with user message body
- `POST /api/session/:id/steer` — sends `steer` RPC command
- `POST /api/session/:id/abort` — sends `abort` RPC command

All three are thin wrappers around `sendCommand()` from `src/rpc.ts`.

### 2. Build prompt input component

Create `frontend/src/components/PromptInput.tsx`:
- Auto-resizing Textarea (from TICKET-003) that grows with content up to a max height
- iOS keyboard optimized (autocorrect and dictation enabled)
- Send button transforms to abort button during streaming
- Visual feedback for send state (sending, sent, error)
- Support for `prompt`, `steer`, and `follow_up` delivery modes (e.g., long-press send for mode selection)

### 3. Build streaming message component

Create `frontend/src/components/StreamingMessage.tsx`:
- Connects to the SSE stream (`/api/session/:id/stream` from TICKET-008)
- Renders tokens incrementally as they arrive (append to DOM, don't re-render full message)
- Target <50ms perceived latency from server emit to screen render
- Tool execution events shown as compact status indicators (collapsed by default, expandable)
- Uses Preact signals for efficient partial updates without full component re-renders

### 4. Integrate with session detail view

Wire PromptInput and StreamingMessage into SessionDetail (from TICKET-005). When the session has an active RPC connection, show the input bar at the bottom. New streaming messages append to the chat view with auto-scroll.

## Maintainability

- [ ] **Modularity** — PromptInput and StreamingMessage are standalone components, usable independently
- [ ] **DRY check** — Streaming message rendering reuses ChatBubble and content extraction from TICKET-005
- [ ] **Debt impact** — SSE reconnection logic should be robust from the start (auto-reconnect on drop)

**Specific refactoring tasks:** Ensure ChatBubble from TICKET-003 supports a "streaming" variant that handles incremental content updates.

## Testing Requirements

### Verification Checklist

```bash
npm run build  # Must pass
# With an active session connected:
curl -X POST http://localhost:8081/api/session/<id>/prompt -H 'Content-Type: application/json' -d '{"message":"hello"}'
# SSE stream should emit message_update events
```

## Acceptance Criteria

- [ ] `POST /api/session/:id/prompt` sends a prompt to the active session
- [ ] `POST /api/session/:id/abort` aborts the current operation
- [ ] `POST /api/session/:id/steer` sends a steer command
- [ ] PromptInput auto-resizes and supports iOS dictation
- [ ] Send button transforms to abort button during streaming
- [ ] Streaming tokens render incrementally with <50ms perceived latency
- [ ] Tool execution events display as compact, expandable indicators
- [ ] New messages auto-scroll the chat view
- [ ] SSE connection auto-reconnects on drop

## Files to Modify

| File | Change |
|------|--------|
| MODIFY: `src/server.ts` | Add `/api/session/:id/prompt`, `/steer`, `/abort` routes |
| NEW: `frontend/src/components/PromptInput.tsx` | Mobile prompt input with send/abort |
| NEW: `frontend/src/components/StreamingMessage.tsx` | Incremental streaming message renderer |
| MODIFY: `frontend/src/components/SessionDetail.tsx` | Integrate prompt input and streaming |
