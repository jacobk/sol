# TICKET-015: Session Detail Rendering Consistency and Conversation Filtering

**Related:** ADR 001, ADR 005, PRD Section 2.2, 2.11, 3.2, 3.2.5
**Feature:** [Session Detail View](../features/session-detail.md)
**Status:** In Review
**Created:** 2026-03-01

## Context to Load

Files the implementation agent MUST read first:

1. `docs/PRD/001-sol.md` Sections 2.11, 3.2, 3.2.5 - Filtering requirements and conversation view
2. `docs/features/session-detail.md` - Updated feature documentation
3. `frontend/src/components/SessionDetail.tsx` - Main component to modify
4. `frontend/src/components/StreamingMessage.tsx` - Streaming rendering (for consistency analysis)
5. `frontend/src/components/ui/index.ts` - UI primitives used

## Problem Statement

Three issues need to be addressed:

### 1. Rendering Inconsistency
Messages sent from Sol via active RPC sessions appear differently than historical messages:
- `StreamingMessage.tsx` renders during streaming with its own UI
- Once complete, entries arrive via SSE `session_entry` and append to `data.entries`
- The transition may cause visual inconsistency

### 2. Aggressive Collapse Behavior
Current `shouldCollapseByDefault()` collapses:
- Assistant messages if >300 chars or no text content
- User messages if >300 chars

**Required behavior:** User and assistant messages should NEVER collapse by default. Only tool results, compaction summaries, and branch summaries should collapse.

### 3. Missing Conversation Filters
Pi CLI has filter modes (via Ctrl+O in tree view):
- Default
- No Tools (hides tool results)
- User Only
- All

Sol needs equivalent filtering via the toolbar menu.

## Implementation Checklist

### 1. Fix Collapse Behavior

Modify `shouldCollapseByDefault()` in `SessionDetail.tsx`:
- User messages: `return false` (never collapse)
- Assistant messages: `return false` (never collapse)
- Tool results: `return true` (always collapse)
- Bash executions: `return true` (always collapse)
- Compaction/branch summaries: `return true` (always collapse)

### 2. Fix Thinking Visibility

Update `ContentBlocks` component to always show thinking inline:
- Remove the conditional collapse for long thinking (>200 chars)
- Render all thinking as muted italic text inline
- No `<details>` collapsible wrapper

### 3. Add Conversation Filter State

Add filter state to `SessionDetail`:
```typescript
type ConversationFilter = "default" | "no-tools" | "user-only" | "all";
const [filter, setFilter] = useState<ConversationFilter>("default");
```

### 4. Implement Filter Logic

Create filter function:
```typescript
function filterEntries(entries: SessionEntry[], filter: ConversationFilter): SessionEntry[] {
  switch (filter) {
    case "no-tools":
      return entries.filter(e => 
        e.type !== "message" || 
        (e.message.role !== "toolResult" && e.message.role !== "bashExecution")
      );
    case "user-only":
      return entries.filter(e => 
        e.type === "message" && e.message.role === "user"
      );
    case "all":
      return entries; // Show everything including hidden custom entries
    default:
      return entries.filter(e => isRenderable(e));
  }
}
```

### 5. Add Filter Menu to Toolbar

Add filter selector to toolbar actions:
- Add "Filter" button to toolbar
- Opens a bottom sheet or dropdown with filter options
- Shows active filter as badge when not "default"

### 6. Verify Streaming-to-Historical Transition

Analyze the flow:
1. `StreamingMessage.tsx` shows message while streaming
2. On `agent_end`, streaming UI clears
3. `session_entry` SSE events add entries to `data.entries`
4. Entries render via `renderEntry()` in `SessionDetail.tsx`

Verify that:
- Completed messages render identically via both paths
- No duplicate messages appear
- Transition is smooth without flash

### 7. Update Streaming Message Styling

If streaming UI differs from final rendering:
- Update `StreamingMessageBubble` to match `renderMessageEntry` styling
- Use same `ChatBubble` component with same props
- Ensure thinking visibility matches (inline, not hidden)

## Maintainability

Before implementing, review for:

- [x] **Refactor opportunity?** Filter logic should be extracted to a utility function for reuse
- [x] **DRY check** - `shouldCollapseByDefault` is the single source of collapse decisions
- [x] **Modularity** - Filter can be a separate component or hook
- [x] **Debt impact** - This reduces debt by simplifying collapse logic

**Specific refactoring tasks:**
- Extract filter logic to `frontend/src/utils/filters.ts` for reuse in search/tree views
- Consider extracting `ConversationFilter` type to shared types file

## Testing Requirements

### Verification Checklist

Implementation agent MUST run before marking complete:
```bash
npm run build  # Must pass
npm test       # Must pass
```

### Manual Testing

1. Load a historical session - verify user/assistant messages are expanded
2. Connect to session, send a prompt - verify rendered message matches historical style
3. Apply "No Tools" filter - verify tool results hidden, user/assistant visible
4. Apply "User Only" filter - verify only user messages visible
5. Return to "Default" - verify all messages visible again
6. Verify thinking content always visible (not collapsed)

## Acceptance Criteria

- [x] User messages are NEVER collapsed by default
- [x] Assistant messages are NEVER collapsed by default
- [x] Tool results and bash executions ARE collapsed by default
- [x] Thinking content is always visible inline (no collapse)
- [x] Filter menu available in toolbar
- [x] "No Tools" filter hides tool results and bash executions
- [x] "User Only" filter shows only user messages
- [x] Active filter indicated visually when not "default"
- [x] Messages sent via active session render identically to historical messages
- [x] Build passes with no TypeScript errors

## Files to Modify

| File | Change |
|------|--------|
| MODIFY: `frontend/src/components/SessionDetail.tsx` | Fix collapse logic, add filter state/UI, fix thinking visibility |
| NEW: `frontend/src/utils/filters.ts` | Filter logic utility (optional extraction) |
| MODIFY: `frontend/src/components/StreamingMessage.tsx` | Verify/align styling with SessionDetail (if needed) |

## Notes

- Do NOT duplicate ADR/PRD content - reference it
- Filter state does not persist across sessions (intentional)
- "Labeled Only" filter omitted (labels not yet exposed in Sol)
- Streaming consistency should be verified empirically - may not need code changes
