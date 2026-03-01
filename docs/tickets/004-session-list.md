# TICKET-004: Session List API and UI

**Related:** ADR 002, PRD 001 Section 3.1
**Feature:** [Session Discovery](../features/session-discovery.md)
**Status:** Ready for Implementation (depends on TICKET-001, TICKET-003)
**Created:** 2026-03-01

## Context to Load

1. `docs/ADR/002-session-discovery-via-sdk.md` - SDK usage for `SessionManager.listAll()`
2. `docs/PRD/001-sol.md` Section 3.1 - Session list requirements
3. `docs/features/session-discovery.md` - Feature overview and design decisions
4. `src/server.ts` - Existing server to add endpoint to

## Implementation Checklist

### 1. Add GET /api/sessions endpoint

Create `src/sessions.ts` with session discovery logic. Call `SessionManager.listAll()`. Map results to JSON response: `{ path, id, cwd, name, created, modified, messageCount, firstMessage }`. Sort by modified descending.

### 2. Group sessions by project

Decode project directory from session metadata (use `cwd` from `SessionInfo`). Return grouped structure: `{ project: string, sessions: SessionInfo[] }[]`.

### 3. Build session list Preact component

Create `frontend/src/components/SessionList.tsx` — card layout grouped by project directory. Use UI primitives from TICKET-003 (Badge for message count, typography components for metadata). Each card shows: session name or first message preview (truncated), message count, relative timestamp ("2h ago", "yesterday"). Tapping a card navigates to session detail view.

### 4. Add pull-to-refresh or refresh button

Manual refresh to re-scan sessions. Use Button primitive from TICKET-003.

### 5. Handle empty state

Display a meaningful empty state when no sessions exist on the machine.

## Maintainability

- [ ] **Modularity** — Session discovery logic in `src/sessions.ts`, not inline in route handler
- [ ] **DRY check** — Timestamp formatting utility should be reusable across components
- [ ] **Modularity** — Session listing function reusable by search endpoint (TICKET-007)

**Specific refactoring tasks:** Extract session listing into `src/sessions.ts` so it can be reused by the search endpoint later.

## Testing Requirements

### Verification Checklist

```bash
npm run build  # Must pass
curl http://localhost:8081/api/sessions | jq .  # Returns session array
```

## Acceptance Criteria

- [ ] `/api/sessions` returns all sessions found on the machine
- [ ] Sessions are grouped by project directory
- [ ] Sessions within each group are sorted by last modified descending
- [ ] Preact UI displays session cards with metadata using design system primitives
- [ ] Empty state shown when no sessions exist
- [ ] Response time <200ms for typical session count (~50 sessions)

## Files to Modify

| File | Change |
|------|--------|
| MODIFY: `src/server.ts` | Add `/api/sessions` route |
| NEW: `src/sessions.ts` | Session discovery and formatting logic |
| NEW: `frontend/src/components/SessionList.tsx` | Session list UI with grouping |
