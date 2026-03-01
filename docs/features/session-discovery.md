# Session Discovery

## Overview

Scans `~/.pi/agent/sessions/` to find all pi sessions on the machine, extracts metadata from each, and presents them as a grouped, sorted list. This is the landing page of the application.

## User Stories

From [PRD 001](../PRD/001-sol.md) Section 2.1:
- "As a developer, I want to see all my pi sessions grouped by project directory so I can find past conversations without remembering file paths."
- "As a developer, I want sessions sorted by recency so the most relevant ones appear first."
- "As a developer, I want to see session metadata (message count, timestamps, first message preview) so I can identify sessions at a glance."

## Implementation

> **Note:** This section is completed by the implementation agent.

### Key Files

| File | Purpose |
|------|---------|
| `src/sessions.ts` | Session discovery logic — `listGroupedSessions()` using `SessionManager.listAll()` |
| `src/app.ts` | Express server with `/api/sessions` endpoint |
| `frontend/src/components/SessionList.tsx` | Session list UI with project grouping, cards, and empty state |
| `frontend/src/utils/format.ts` | Reusable `formatRelativeTime()` and `truncate()` utilities |

### Data Flow

1. Frontend `SessionList` component fetches `GET /api/sessions` on mount (and on refresh button tap).
2. Express route handler calls `listGroupedSessions()` from `src/sessions.ts`.
3. `listGroupedSessions()` calls `SessionManager.listAll()` from the pi SDK, maps `SessionInfo` objects to `SessionResponse` JSON, groups by `cwd`, and sorts by modified descending.
4. Response is `GroupedSessions[]` — each group has a `project` string and `sessions` array.

### Key Functions

| Function | File | Purpose |
|----------|------|---------|
| `listGroupedSessions()` | `src/sessions.ts` | Lists all sessions via SDK, groups by project, sorts by recency |
| `formatRelativeTime()` | `frontend/src/utils/format.ts` | Converts ISO timestamp to relative string ("2h ago", "yesterday") |
| `truncate()` | `frontend/src/utils/format.ts` | Truncates text with ellipsis |

## Rationale

### Design Decisions

- Sessions grouped by project directory (decoded from the session folder name) rather than a flat list, because developers think in terms of projects.
- Sort by last modified descending within each group — the most recently active session is most likely what you're looking for.
- Use `SessionManager.listAll()` rather than manual file scanning to get version migration and metadata extraction for free.

### ADR References

- [ADR 002: Session Discovery via SDK](../ADR/002-session-discovery-via-sdk.md) - Why we use the SDK instead of direct JSONL parsing
- [ADR 003: Standalone Server Architecture](../ADR/003-standalone-server-architecture.md) - Why this runs as a standalone server

## Current Limitations

1. No caching — every request re-scans the sessions directory. Fine for <100 sessions, may need `fs.watch()` caching for larger sets.
2. No pagination — all sessions returned in one response.

## Related Features

- [Session Management](session-management.md) - Adds "New Session" creation from the session list
