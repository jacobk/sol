# TICKET-005: Session Detail API and Chat View

**Related:** ADR 001, ADR 002, PRD 001 Section 3.2
**Feature:** [Session Detail View](../features/session-detail.md)
**Status:** Ready for Implementation (depends on TICKET-003, TICKET-004)
**Created:** 2026-03-01

## Context to Load

1. `docs/ADR/002-session-discovery-via-sdk.md` - `SessionManager.open()` and entry access
2. `docs/PRD/001-sol.md` Section 3.2 - Conversation view requirements
3. `docs/features/session-detail.md` - Feature overview and message type handling
4. `src/sessions.ts` - Session discovery module (from TICKET-004)

## Implementation Checklist

### 1. Add GET /api/session/:id endpoint

Look up session by UUID (scan sessions to match `id` from header). Call `SessionManager.open(path)`, return `sm.getBranch()` as the current branch entries plus `sm.getHeader()` as metadata.

### 2. Build chat view Preact component

Create `frontend/src/components/SessionDetail.tsx` — scrollable list of messages rendered using ChatBubble primitives from TICKET-003. Style by role:

| Role | Styling |
|------|---------|
| user | User ChatBubble variant |
| assistant | Assistant ChatBubble variant, model/tokens/cost metadata via Badge |
| toolResult | Tool ChatBubble variant, tool name label, error state highlighted |
| bashExecution | Tool ChatBubble variant, command shown, output in Code typography |
| compactionSummary | System ChatBubble variant, "COMPACTION" label |
| branchSummary | System ChatBubble variant, "BRANCH" label |
| custom | System ChatBubble variant, customType as label |

### 3. Build content extraction utility

Create `frontend/src/utils/content.ts` — extract display text from all content block types: `text`, `thinking` (collapsible), `toolCall` (show name + args summary), `image` (show placeholder). This utility will be reused by search highlighting (TICKET-007) and tree previews (TICKET-006).

### 4. Display assistant metadata

Show model name (Badge), token usage, and cost per assistant message. Use Metadata typography component.

### 5. Wire session list → detail navigation

Tapping a session card in SessionList navigates to SessionDetail. Add back navigation to return to the list. Use client-side routing or simple state management.

## Maintainability

- [ ] **Modularity** — Content extraction in a shared utility, not inline in components
- [ ] **DRY check** — ChatBubble variants from TICKET-003 handle role-specific styling; no duplicate CSS
- [ ] **Modularity** — Session-by-id lookup function in `src/sessions.ts`, reusable by tree and search endpoints

**Specific refactoring tasks:** Ensure content extraction utility is generic enough for reuse by TICKET-006 (tree previews) and TICKET-007 (search highlighting).

## Testing Requirements

### Verification Checklist

```bash
npm run build  # Must pass
# Get a session ID from /api/sessions, then:
curl http://localhost:8081/api/session/<id> | jq '.entries | length'
```

## Acceptance Criteria

- [ ] `/api/session/:id` returns entries for the requested session
- [ ] Returns 404 for unknown session IDs
- [ ] Chat view renders all message types with distinct ChatBubble styling
- [ ] Assistant messages show model, token count, and cost
- [ ] Tool results show tool name and error state
- [ ] Navigation from session list to detail and back works
- [ ] Long sessions are scrollable with smooth momentum on iPhone Safari

## Files to Modify

| File | Change |
|------|--------|
| MODIFY: `src/server.ts` | Add `/api/session/:id` route |
| MODIFY: `src/sessions.ts` | Add session-by-id lookup function |
| NEW: `frontend/src/components/SessionDetail.tsx` | Chat view with message rendering |
| NEW: `frontend/src/utils/content.ts` | Content extraction utility |
