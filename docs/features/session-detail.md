# Session Detail View

## Overview

Loads a single session's JSONL entries and renders the current branch as a scrollable chat view. Handles all message types (user, assistant, tool results, bash executions, compactions, branch summaries) with distinct visual styling. Displays assistant metadata including model, token usage, and cost.

Session detail has two operational modes that must render messages identically:
1. **Historical mode**: Reads session entries from disk via SDK
2. **Active mode**: Receives session entries via SSE from an RPC-connected pi subprocess

Both modes must use the same rendering components to ensure visual consistency.

## User Stories

From [PRD 001](../PRD/001-sol.md) Section 2.2:
- "As a developer, I want to view a session's full conversation history with proper formatting so I can review what the agent did."
- "As a developer, I want user messages, assistant responses, and tool results visually distinguished so the conversation is easy to follow."
- "As a developer, I want to see model info, token counts, and cost per message so I can understand resource usage."

From [PRD 001](../PRD/001-sol.md) Section 2.11 (Conversation Filtering):
- "As a developer, I want to filter the conversation to show only user messages so I can quickly scan what I asked."
- "As a developer, I want to hide tool executions so I can focus on the conversational flow."
- "As a developer, I want to see thinking content inline so I can understand the agent's reasoning process."

## Implementation

> **Note:** This section is completed by the implementation agent.

### Key Files

| File | Purpose |
|------|---------|
| `src/app.ts` | `/api/session/:id` endpoint |
| `src/sessions.ts` | `getSessionById()` lookup function |
| `frontend/src/components/SessionDetail.tsx` | Chat view with role-based rendering |
| `frontend/src/utils/content.ts` | Content extraction utility |
| `frontend/src/App.tsx` | Navigation state between list and detail |

### Data Flow

1. User taps a session card in `SessionList` → `onSelectSession(id)` → `App` sets `selectedSessionId`
2. `SessionDetail` mounts, fetches `GET /api/session/:id`
3. Backend calls `getSessionById()` which scans all sessions for matching UUID, opens via `SessionManager.open()`, returns `getBranch()` entries + `getHeader()`
4. Frontend maps entries to `ChatBubble` components with role-specific styling

### Key Functions

- `getSessionById(id)` — Backend: finds session by UUID, returns branch entries + header
- `extractAllContent(blocks)` — Frontend: extracts display text from content block arrays
- `extractPlainText(blocks)` — Frontend: extracts plain text only (for search/previews)
- `renderEntry(entry)` — Frontend: dispatches to role-specific ChatBubble rendering

## Rationale

### Design Decisions

- Render the current branch (root → leaf) as a linear chat, not the full tree. This matches how conversations are experienced.
- All message types rendered with role-specific styling (colored left borders, role labels) for clear visual distinction between roles.
- Tool results show the tool name prominently — when reviewing agent work, knowing which tool was called is as important as the result.

### Collapse Behavior (Updated: 2026-03-01)

**User and assistant messages should NOT be collapsed by default.** Only the following should collapse:
- Tool results (bash, read, write, edit, etc.)
- Compaction summaries
- Branch summaries
- Custom messages

This matches the pi CLI behavior where the conversational flow between user and agent is always visible.

### Thinking Visibility (Updated: 2026-03-01)

**Thinking content should always be visible**, displayed inline as muted italic text. This matches the pi CLI behavior where thinking is part of the natural reading flow. Do NOT hide thinking in collapsed sections.

### Conversation Filtering (Updated: 2026-03-01)

Sol should support the same filter modes as the pi CLI terminal app:

| Filter Mode | Description | Equivalent to pi CLI |
|-------------|-------------|---------------------|
| Default | Shows all messages | Default view |
| No Tools | Hides tool results and bash executions | no-tools (Ctrl+O toggle) |
| User Only | Shows only user messages | user-only |
| Labeled Only | Shows only labeled entries | labeled-only |
| All | Shows everything including hidden entries | all |

Filters are accessible via the session toolbar menu. Active filter is indicated visually.

### Rendering Consistency (Updated: 2026-03-01)

Both historical mode and active mode must render messages using the **same components**:
- Historical entries: Rendered by `SessionDetail.tsx`
- Active streaming: `StreamingMessage.tsx` renders during streaming, but completed entries arrive via SSE `session_entry` events and are appended to the same entry list, rendered by the same rendering functions

The streaming message component should only handle the temporary "in-progress" display. Once an entry is complete and written to the session file, it arrives as a `session_entry` SSE event and should be rendered using the standard entry rendering path.

### ADR References

- [ADR 001: Tech Stack](../ADR/001-tech-stack.md) - Preact + Vite frontend rendering approach
- [ADR 002: Session Discovery via SDK](../ADR/002-session-discovery-via-sdk.md) - SessionManager API for entry access

## Current Limitations

1. Large sessions (1000+ entries) may be slow to render as a single scrollable page.
2. Filtering requires re-rendering the entire entry list (no virtualization yet).
