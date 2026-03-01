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
| `src/server.ts` | `/api/session/:id` endpoint |
| `public/index.html` | Chat-style message rendering |

### Data Flow

{To be filled during implementation.}

### Key Functions

{To be filled during implementation.}

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
