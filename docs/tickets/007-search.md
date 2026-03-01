# TICKET-007: Full-Text Search

**Related:** ADR 002, PRD 001 Section 3.8
**Feature:** [Search](../features/search.md)
**Status:** Ready for Implementation (depends on TICKET-004, TICKET-005)
**Created:** 2026-03-01

## Context to Load

1. `docs/ADR/002-session-discovery-via-sdk.md` - `allMessagesText` from `SessionInfo`
2. `docs/PRD/001-sol.md` Section 3.8 - Search requirements
3. `docs/features/search.md` - Feature overview and two-tier search design
4. `src/sessions.ts` - Session listing module (reuse for filtering)

## Implementation Checklist

### 1. Add GET /api/sessions/search?q=term endpoint

In `src/sessions.ts`, add search function. Call `SessionManager.listAll()`, filter sessions where `allMessagesText` includes the search term (case-insensitive). Return matching sessions with hit count (number of occurrences).

### 2. Add GET /api/session/:id/search?q=term endpoint

Open specific session, scan entries for matches. Return matching entry IDs with surrounding context (snippet of text around the match).

### 3. Build search Preact component

Create `frontend/src/components/Search.tsx` — search bar with as-you-type filtering (300ms debounce). Results show session cards (reuse SessionList card component) with match count Badge. Tapping a result navigates to SessionDetail.

### 4. Highlight matches in session detail

When navigating to a session from a search result, pass the query term. Scroll to first match and highlight matching text spans using an accent color.

## Maintainability

- [ ] **Modularity** — Search filtering reuses session listing from `src/sessions.ts`
- [ ] **DRY check** — Session card rendering shared between SessionList and Search results (extract to shared component if not already)

**Specific refactoring tasks:** If SessionList card is not already a standalone component, extract it for reuse by Search results.

## Testing Requirements

### Verification Checklist

```bash
npm run build  # Must pass
curl 'http://localhost:8081/api/sessions/search?q=test' | jq '. | length'
```

## Acceptance Criteria

- [ ] `/api/sessions/search?q=term` returns matching sessions with hit counts
- [ ] Search is case-insensitive
- [ ] Empty query returns all sessions (same as `/api/sessions`)
- [ ] `/api/session/:id/search?q=term` returns matching entries with context snippets
- [ ] Search UI provides results as you type with debounce
- [ ] Tapping a search result navigates to the session detail
- [ ] Response time <500ms for typical session count

## Files to Modify

| File | Change |
|------|--------|
| MODIFY: `src/server.ts` | Add search routes |
| MODIFY: `src/sessions.ts` | Add search/filter functions |
| NEW: `frontend/src/components/Search.tsx` | Search bar and results UI |
| MODIFY: `frontend/src/components/SessionDetail.tsx` | Match highlighting support |
