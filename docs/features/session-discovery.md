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
| `src/server.ts` | Express server with `/api/sessions` endpoint |
| `public/index.html` | Session list UI |

### Data Flow

{To be filled during implementation.}

### Key Functions

{To be filled during implementation.}

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
