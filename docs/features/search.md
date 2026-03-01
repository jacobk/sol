# Search

## Overview

Full-text search across all pi sessions on the machine. Uses `allMessagesText` from `SessionInfo` for fast pre-filtering of the session list, with server-side entry scanning for detailed within-session matches.

## User Stories

From [PRD 001](../PRD/001-sol.md) Section 2.4:
- "As a developer, I want to search across all sessions by keyword so I can find specific conversations or topics."
- "As a developer, I want search results to link directly to the matching session and entry so I can jump to context quickly."

## Implementation

> **Note:** This section is completed by the implementation agent.

### Key Files

| File | Purpose |
|------|---------|
| `src/server.ts` | `/api/sessions/search` and `/api/session/:id/search` endpoints |
| `public/index.html` | Search bar and results rendering |

### Data Flow

{To be filled during implementation.}

### Key Functions

{To be filled during implementation.}

## Rationale

### Design Decisions

- Two-tier search: fast session-level filtering using `allMessagesText` (already computed by `listAll()`), then optional drill-down into individual entries.
- Server-side search rather than sending all session text to the client — sessions can be large and the phone's bandwidth/memory is limited.
- Simple substring matching initially — no need for full-text indexing at current scale (~50 sessions, ~2MB).

### ADR References

- [ADR 002: Session Discovery via SDK](../ADR/002-session-discovery-via-sdk.md) - `SessionManager.listAll()` provides `allMessagesText` for pre-filtering

## Current Limitations

1. No indexing — search is O(n) over all session text on every query. Fine for <100 sessions.
2. No regex or advanced query syntax — plain substring matching only.
3. No result highlighting within the session detail view (initial implementation shows matching entries, not highlighted text).
