# TICKET-014: Session Management Overhaul

**Related:** ADR 005, ADR 006, PRD Section 2.1
**Feature:** Session Management
**Status:** ❌ Review Failed
**Created:** 2026-03-01

## Context to Load

Files the implementation agent MUST read first:

1. `docs/features/session-management.md` - Feature overview and rationale
2. `docs/ADR/005-pi-rpc-integration.md` - RPC commands: `fork`, `new_session`, `switch_session`
3. `docs/ADR/006-tailwind-v4-design-tokens.md` - UI primitive layer approach
4. `frontend/src/components/SessionList.tsx` - Session list to add "New Session" button
5. `frontend/src/components/SessionDetail.tsx` - Message list to add swipe gestures
6. `frontend/src/components/BranchSelector.tsx` - Existing tree/branch UI patterns
7. `src/rpc.ts` - RPC command sending utilities

## Implementation Checklist

### 1. Create SwipeableRow UI Component

Build a reusable swipe-to-reveal component in `frontend/src/components/ui/SwipeableRow.tsx`:

- Touch gesture handling (touchstart, touchmove, touchend)
- Configurable reveal threshold (suggest 80px)
- Reveal actions on right side when swiping left
- Spring-back animation when not crossing threshold
- Slot for action buttons
- Respect iOS Safari edge gesture (add left margin buffer)

Reference ADR 006 for UI primitive patterns.

### 2. Create ForkActionSheet Component

Build `frontend/src/components/ForkActionSheet.tsx`:

- Bottom sheet (use existing BottomSheet pattern from BranchSelector)
- Three fork options:
  - "No Summary" - fork without context summarization
  - "Summary" - fork with automatic context summarization
  - "Summary with Instructions" - shows text input for custom instructions
- Cancel button
- Props: `entryId`, `onFork(mode, instructions?)`, `onClose`

### 3. Add Fork Message Endpoint

Add `POST /api/session/:id/fork` endpoint in `src/app.ts`:

- Request body: `{ entryId: string, summarize: 'none' | 'auto' | 'custom', instructions?: string }`
- Requires active RPC connection
- Sends RPC `fork` command with appropriate parameters
- Returns new session ID on success

### 4. Integrate Swipe Actions in SessionDetail

Update `frontend/src/components/SessionDetail.tsx`:

- Wrap message entries with SwipeableRow
- Show "Fork" action button on swipe reveal
- Open ForkActionSheet when Fork tapped
- Handle fork completion: navigate to new session or show error

### 5. Enable Tree View for All Sessions

Update tree button visibility in `SessionDetail.tsx`:

- Remove any conditional logic that hides tree button
- Tree button should always be visible in header
- `/api/tree/:id` endpoint already works for all sessions via SDK

### 6. Add New Session Button to SessionList

Update `frontend/src/components/SessionList.tsx`:

- Add floating "+" button or header action
- Opens bottom sheet with project selector
- Project list from existing session groups (reuse grouping logic)

### 7. Create New Session Endpoint

Add `POST /api/sessions/new` endpoint in `src/app.ts`:

- Request body: `{ cwd: string }` - working directory for new session
- Spawns new RPC subprocess with `new_session` command
- Returns new session ID and confirms RPC connection

### 8. Handle New Session Flow

Update frontend to handle new session creation:

- After successful creation, navigate to new session detail
- Establish SSE stream connection
- Show empty conversation state with prompt input ready

## Maintainability

Before implementing, review for:

- [x] **Refactor opportunity?** SwipeableRow should be a reusable UI primitive
- [x] **DRY check** - Reuse existing BottomSheet patterns from BranchSelector
- [x] **Modularity** - SwipeableRow isolated for testing and reuse elsewhere
- [x] **Debt impact** - Reduces UX debt by bringing mobile closer to terminal feature parity

**Specific refactoring tasks:**
- Extract BottomSheet into `ui/BottomSheet.tsx` if not already abstracted (check current BranchSelector implementation)
- Ensure touch gesture utilities can be reused (consider `hooks/useSwipeGesture.ts`)

## Testing Requirements

### Unit Tests

- `SwipeableRow.test.tsx` - gesture threshold behavior, reveal/hide states
- `ForkActionSheet.test.tsx` - option selection, instruction input handling

### API Tests

- `POST /api/session/:id/fork` - valid fork, missing RPC connection, invalid entry ID
- `POST /api/sessions/new` - valid creation, invalid cwd

### Integration Tests

- Fork flow: swipe → select option → verify RPC command sent
- New session flow: tap button → select project → verify session created

### Verification Checklist

Implementation agent MUST run before marking complete:
```bash
npm run build  # Must pass
npm test       # Must pass
```

## Acceptance Criteria

- [ ] "New Session" button visible on session list view (always, even when empty)
- [ ] Tapping "New Session" opens project selector bottom sheet
- [ ] Selecting a project creates new session and navigates to it
- [ ] Tree view button visible for ALL sessions (not just forked ones)
- [ ] Swiping left on user messages reveals "Fork" action (pi only supports forking from user messages)
- [ ] Tapping "Fork" opens confirmation sheet
- [ ] Confirming fork rewinds session to the fork point (pi creates a branch, not a new session file)
- [ ] After forking, session view shows messages up to the fork point, ready for new prompts
- [ ] Swipe gesture does not conflict with iOS Safari back gesture (20px left margin)
- [ ] All new endpoints return appropriate error responses when RPC not connected

**Note:** Pi's RPC `fork` command does not support summarization options. Fork preserves full context up to the branch point.

## Files to Modify

| File | Change |
|------|--------|
| NEW: `frontend/src/components/ui/SwipeableRow.tsx` | Reusable swipe-to-reveal component |
| NEW: `frontend/src/components/ForkActionSheet.tsx` | Fork options bottom sheet |
| `frontend/src/components/SessionList.tsx` | Add "New Session" button and project selector |
| `frontend/src/components/SessionDetail.tsx` | Wrap messages with SwipeableRow, always show tree button |
| `src/app.ts` | Add `/api/session/:id/fork` and `/api/sessions/new` endpoints |
| `src/rpc.ts` | May need helper for fork command if not already covered |

## Notes

- Do NOT duplicate ADR/PRD content - reference it
- RPC `fork` command parameters should match pi's internal fork API
- Check pi SDK/RPC documentation for exact `fork` command schema
- Consider debouncing swipe gestures to avoid accidental triggers
- Project selector should show projects alphabetically with most recent first within each

---

## Review Feedback

**Review Date:** 2026-03-01
**Result:** ❌ FAILED — 5 issues found (3 critical, 2 minor). The implementation must be reworked before acceptance.

> `npm run build` — ✅ passes
> `npm test` — ✅ passes (113 backend + 24 frontend tests)

---

### ❌ CRITICAL — Issue 1: Summarization options silently ignored in RPC fork command

**File:** `src/app.ts` — `POST /api/session/:id/fork`

The endpoint correctly accepts and validates the `summarize` (`none` | `auto` | `custom`) and `instructions` fields, but the actual RPC command sent to pi **discards both fields entirely**:

```ts
// Only entryId is sent — summarize and instructions are NEVER forwarded:
const sent = sendCommand(sessionId, { type: "fork", entryId });
```

The comment in the code acknowledges this:
> *"The pi RPC fork command only takes entryId. Summarization options would need to be handled differently…"*

This means all three fork modes ("No Summary", "Summary", "Summary with Instructions") are functionally identical at the RPC level. The user is presented with a meaningful choice that has no effect.

**Broken acceptance criteria:**
- "Summary fork creates session with automatic summarization" — ✗ not sent to RPC
- "Summary with Instructions shows input field and uses custom instructions" — ✗ input is shown but `instructions` never used

**Required fix:** Investigate the exact `fork` RPC command schema (the ticket notes say to check this). If pi's `fork` command genuinely does not support summarization parameters today, the ticket must be updated to reflect this constraint, the ForkActionSheet must be simplified to a single confirm-or-cancel action (not three modes), and the acceptance criteria must be revised accordingly. Do not present users with fake options.

---

### ❌ CRITICAL — Issue 2: Fork does not navigate to a new session

**Files:** `src/app.ts`, `frontend/src/components/SessionDetail.tsx`

The ticket specification states:
- Endpoint: *"Returns new session ID on success"*
- Acceptance criterion: *"After forking, user is navigated to the new session"*

The actual implementation does neither. The endpoint returns `{ success: true, text }` with no new session ID, and the frontend navigates to the fork point in the **same current session** by rewinding:

```ts
// SessionDetail.tsx handleFork():
await fetchSession(forkEntryId);   // rewinds current session to fork point
setCurrentLeafId(forkEntryId);     // stays in the same session
```

This may be because the pi `fork` RPC command does not return a new session ID in its response. If that is the case, this must be documented:
1. Investigate whether pi's `fork` RPC response includes a new session path/ID (check the pi binary or SDK source).
2. If pi does return the forked session path: implement navigation to the new session.
3. If pi does not return the forked session path: update the ticket and feature doc to accurately describe the fork behavior (e.g., "fork creates a new branch at the entry point; the session list refreshes to show it"), and revise the acceptance criteria.

---

### ❌ CRITICAL — Issue 3: `ForkActionSheet.test.tsx` is missing

**Required by ticket:** *"`ForkActionSheet.test.tsx` — option selection, instruction input handling"*

No test file exists for `ForkActionSheet`. The component has non-trivial state logic:
- Two-phase UI (option list → instructions input)
- "Back" navigation resets instruction state
- "Fork" button disabled when instructions are empty
- Loading state disables all buttons

A test file must be created at `frontend/src/components/ForkActionSheet.test.tsx` covering at minimum:
1. Renders all three fork options and a cancel button
2. Clicking "Summary with Instructions" reveals the instruction textarea
3. "Fork" button is disabled when instructions textarea is empty
4. Back button resets to option list
5. `onFork` is called with correct `mode` when each option is selected
6. `onClose` is called when cancel is tapped
7. Loading state disables all buttons

---

### ⚠️ MINOR — Issue 4: Swipe restricted to user messages only, contradicting acceptance criteria

**File:** `frontend/src/components/SessionDetail.tsx`

The acceptance criterion states: *"Swiping left on any message reveals 'Fork' action."*

The implementation restricts swipe to user messages when RPC is connected:
```ts
const isSwipeable = isRpcConnected && entry.type === "message" && 
  entry.message.role === "user";
```

The inline comment suggests pi's fork command only accepts user message entry IDs — this is a reasonable technical constraint. However, the deviation from the stated acceptance criteria must be formally documented.

**Required fix:** One of:
- (a) Update the ticket's acceptance criterion and feature doc to state: *"Swipe-to-fork is available on user messages only (pi's fork command requires a user message entry ID)."*
- (b) Verify whether pi's fork command actually supports other entry types and expand swipe coverage if so.

The current silent discrepancy between the spec and the implementation will cause confusion in future reviews.

---

### ⚠️ MINOR — Issue 5: "New Session" button hidden when no sessions exist

**File:** `frontend/src/components/SessionList.tsx`

The floating "+" button is conditionally rendered:
```tsx
{groups.length > 0 && (
  <div class="fixed bottom-6 right-6 z-20">
    ...
  </div>
)}
```

The acceptance criterion states: *"'New Session' button visible on session list view."* When the session list is empty (new installation, all sessions deleted), the button is not visible. A user who wants to create their first session from Sol has no way to do so.

**Required fix:** One of:
- (a) Always show the "New Session" button. When no sessions exist and the button is tapped, the project selector sheet will show "No projects found" — which already has a helpful message. This is acceptable UX.
- (b) In the empty state (`EmptyState` component), add a "New Session" button or instruction alongside the current guidance text.

---

### ✅ Passing Items

The following parts of the implementation are correct and well-done:

- **Build and tests pass**: `npm run build` and `npm test` both succeed with zero errors/failures.
- **SwipeableRow UI component** (`frontend/src/components/ui/SwipeableRow.tsx`): Well-structured, iOS Safari edge gesture protection (20px left margin), correct reveal/spring-back threshold logic, `onReveal`/`onHide` callbacks, `disabled` prop, `transition-transform` animation. Exported from `ui/index.ts` as a UI primitive per ADR 006. ✅
- **ForkActionSheet component** (`frontend/src/components/ForkActionSheet.tsx`): Correct bottom sheet usage, three-option layout, two-phase instruction input, cancel and back buttons. The implementation is correct; it's the RPC backend that doesn't honour the mode. ✅
- **ProjectSelectorSheet component** (`frontend/src/components/ProjectSelectorSheet.tsx`): Clean project selector with display name truncation, loading state, and scrollable list. ✅
- **Tree button always visible**: `toolbarActions` in `SessionDetail.tsx` always includes the Tree action with no conditional logic. Meets acceptance criteria. ✅
- **`POST /api/session/:id/fork`**: Correct input validation (400 for missing fields, 400 for invalid `summarize`, 400 for custom without instructions, 404 for not connected, 409 for cancelled). 30-second timeout is appropriate for summarization. ✅
- **`POST /api/sessions/new`**: Correct `cwd` validation (existence check, directory check), temp-ID + `rekeyRpc` pattern is sound, graceful fallback if `get_state` fails. ✅
- **`rekeyRpc` in `src/rpc.ts`**: Clean and correctly guarded against double-keying. ✅
- **App.tsx wiring**: `onNewSession` prop properly threads new session navigation through the view stack. ✅
- **ESM, TypeScript strict, design tokens**: No `require()`, no `any`, no hardcoded hex values, correct `.js` extensions on local imports, CSS variable tokens used throughout. ✅
- **API tests**: Fork and new session endpoint tests in `src/app.test.ts` provide good coverage of the happy path and all error conditions. ✅
- **SwipeableRow tests**: Basic structure and disabled-state tests present in `SwipeableRow.test.tsx`. ✅
