# Session Detail View

## Overview

Loads a single session's JSONL entries and renders the current branch as a scrollable chat view. Handles all message types (user, assistant, tool results, bash executions, compactions, branch summaries) with distinct visual styling. Displays assistant metadata including model, token usage, and cost.

## User Stories

From [PRD 001](../PRD/001-sol.md) Section 2.2:
- "As a developer, I want to view a session's full conversation history with proper formatting so I can review what the agent did."
- "As a developer, I want user messages, assistant responses, and tool results visually distinguished so the conversation is easy to follow."
- "As a developer, I want to see model info, token counts, and cost per message so I can understand resource usage."

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

### ADR References

- [ADR 001: Tech Stack](../ADR/001-tech-stack.md) - Preact + Vite frontend rendering approach
- [ADR 002: Session Discovery via SDK](../ADR/002-session-discovery-via-sdk.md) - SessionManager API for entry access

## Current Limitations

1. No live updates — if a session is being written to by an active pi instance, you must manually refresh.
2. Large sessions (1000+ entries) may be slow to render as a single scrollable page.
