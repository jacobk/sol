# TICKET-014: Session Management Overhaul

## Objective
Enable session creation from session list, tree view for all sessions, and swipe-to-fork on messages.

## Key Findings

- **Tree button conditional:** Currently hidden when `allBranches.length <= 1` (line 1467, SessionDetail.tsx). Must change to always show tree button.
- **BottomSheet exists:** `frontend/src/components/ui/BottomSheet.tsx` - reuse for ForkActionSheet and ProjectSelector
- **RPC commands:** `fork`, `new_session` available per ADR-005. Need to check exact schema in pi docs.
- **No swipe components:** No existing swipe-to-reveal pattern. Must create `SwipeableRow` from scratch.
- **Touch gesture risk:** iOS Safari back gesture triggered on left edge swipe. Need ~20px left margin buffer.
- **Session creation flow:** `spawnRpc()` requires session path + cwd. For new sessions, need to call `new_session` RPC after spawning subprocess.
- **Project list source:** Can reuse `GroupedSessions` from `/api/sessions` - extract unique project cwds.

## Tasks

- [x] **1. Create SwipeableRow component** — `frontend/src/components/ui/SwipeableRow.tsx`
  Touch gesture handler with 80px reveal threshold, spring-back animation, slot for action buttons, 20px left margin for Safari edge gesture.

- [x] **2. Create ForkActionSheet component** — `frontend/src/components/ForkActionSheet.tsx`
  BottomSheet with 3 fork options + cancel. "Summary with Instructions" shows textarea. Props: `entryId`, `onFork(mode, instructions?)`, `onClose`.

- [x] **3. Add POST /api/session/:id/fork endpoint** — `src/app.ts`
  Body: `{ entryId, summarize: 'none'|'auto'|'custom', instructions? }`. Requires RPC connection. Send `fork` command, wait for response with new session ID.

- [x] **4. Add POST /api/sessions/new endpoint** — `src/app.ts`
  Body: `{ cwd }`. Spawn new pi subprocess, send `new_session` command. Return new session ID.

- [x] **5. Integrate SwipeableRow in SessionDetail** — `frontend/src/components/SessionDetail.tsx`
  Wrap message entries (user/assistant only). Show "Fork" action. On tap → open ForkActionSheet.

- [x] **6. Handle fork completion** — `frontend/src/components/SessionDetail.tsx`
  After successful fork: call `onSelectSession(newSessionId)` or equivalent navigation. Add prop if needed.

- [x] **7. Enable tree view for all sessions** — `frontend/src/components/SessionDetail.tsx`
  Change toolbar to always show Tree button (remove `allBranches.length > 0` condition). Update `collectAllBranches` to return single-branch sessions.

- [x] **8. Create ProjectSelectorSheet component** — `frontend/src/components/ProjectSelectorSheet.tsx`
  BottomSheet with list of projects from existing sessions. Props: `projects: string[]`, `onSelect(cwd)`, `onClose`.

- [x] **9. Add New Session button to SessionList** — `frontend/src/components/SessionList.tsx`
  Floating "+" button or header action. Opens ProjectSelectorSheet. On select → POST /api/sessions/new → navigate to new session.

- [x] **10. Handle new session navigation** — `frontend/src/App.tsx` or `SessionList.tsx`
  After creation: set selectedSessionId, trigger RPC connect, show empty session with prompt input.

- [x] **11. Add unit tests for SwipeableRow** — `frontend/src/components/ui/SwipeableRow.test.tsx`
  Test threshold behavior, reveal/hide states, action slot rendering.

- [x] **12. Add API tests for new endpoints** — `src/app.test.ts`
  Test fork endpoint (valid/invalid), new session endpoint (valid/invalid cwd), RPC not connected errors.

- [x] **13. Export new components from ui/index.ts** — `frontend/src/components/ui/index.ts`
  Add SwipeableRow export.

## Verification
```bash
npm run build   # Must pass
npm test        # Must pass - including new tests
```

Manual verification:
- Create new session from session list
- Swipe left on any message to see Fork action
- Fork with each option (no summary, summary, with instructions)
- Verify tree button visible for linear sessions
- Test on iOS Safari - swipe should not trigger back navigation
