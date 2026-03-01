# TICKET-006: Tree Structure API and Visualization

**Related:** ADR 004, PRD 001 Section 3.7
**Feature:** [Tree Visualization](../features/tree-visualization.md)
**Status:** Ready for Implementation (depends on TICKET-005)
**Created:** 2026-03-01

## Context to Load

1. `docs/ADR/004-tree-visualization-approach.md` - Breadcrumb navigation decision
2. `docs/PRD/001-sol.md` Section 3.7 - Tree navigation requirements
3. `docs/features/tree-visualization.md` - Feature overview
4. `src/sessions.ts` - Session access module

## Implementation Checklist

### 1. Add GET /api/tree/:id endpoint

Open session via `SessionManager.open()`. Return `sm.getTree()` serialized as JSON. Include entry metadata (role, first line of content via content extraction utility, timestamp, child count) for each node so the frontend can render summaries without loading full entries.

### 2. Add branch indicators to chat view

In SessionDetail (from TICKET-005), detect entries that have multiple children (branch points). Render a visual indicator: "⑂ 2 branches" using Badge primitive. The indicator is tappable.

### 3. Build branch selector

Create `frontend/src/components/BranchSelector.tsx` — tapping a branch indicator opens a BottomSheet (from TICKET-003) showing sibling branches. Each option shows: first message on that branch (truncated, via content extraction utility), branch depth (message count), and leaf entry preview. Selecting a branch re-renders the chat view for that path.

### 4. Add tree overview toggle

A button in the session detail header that toggles a compact tree summary view. Shows all branches as a flat list with: branch path description, message count, leaf preview. Tapping a branch switches to it.

## Maintainability

- [ ] **Modularity** — Tree serialization logic in `src/sessions.ts`, separate from route handler
- [ ] **DRY check** — Branch preview text extraction reuses the content extraction utility from TICKET-005

**Specific refactoring tasks:** Verify that the content extraction utility from TICKET-005 handles all entry types needed for tree node summaries.

## Testing Requirements

### Verification Checklist

```bash
npm run build  # Must pass
curl http://localhost:8081/api/tree/<id> | jq '. | length'
```

## Acceptance Criteria

- [ ] `/api/tree/:id` returns the full tree structure for a session
- [ ] Branch points in the chat view show a visual indicator with branch count
- [ ] Tapping a branch indicator opens BottomSheet with sibling branches and previews
- [ ] Selecting a different branch re-renders the chat view
- [ ] Tree overview shows all branches in a compact list
- [ ] Sessions with no branches (linear) show no branch indicators

## Files to Modify

| File | Change |
|------|--------|
| MODIFY: `src/server.ts` | Add `/api/tree/:id` route |
| MODIFY: `src/sessions.ts` | Add tree serialization function |
| MODIFY: `frontend/src/components/SessionDetail.tsx` | Branch indicators, tree overview toggle |
| NEW: `frontend/src/components/BranchSelector.tsx` | Branch selection BottomSheet |
