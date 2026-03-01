# Session Management

## Overview

Enhances Sol's session management capabilities with three key improvements: easy session creation from the session list, tree view access for all sessions (not just forked ones), and the ability to fork sessions from user messages via swipe gestures. These improvements bring Sol closer to feature parity with pi's terminal `/tree` view and make common workflows accessible on mobile.

## User Stories

From [PRD 001](../PRD/001-sol.md) Section 2.1:
- "As a developer, I want to create a new pi session from the session list so I can start fresh work on a project without switching to my laptop."
- "As a developer, I want to view the tree structure for any session so I can explore branches and history regardless of how the session was created."
- "As a developer, I want to fork a session from a user message by swiping left so I can quickly branch the conversation to try a different approach."

## Implementation

> **Note:** This section is completed by the implementation agent.

### Key Files

| File | Purpose |
|------|---------|
| `frontend/src/components/SessionList.tsx` | New session button, project selector |
| `frontend/src/components/SessionDetail.tsx` | Swipe gesture handling on user messages, tree access for all sessions |
| `frontend/src/components/ui/SwipeableRow.tsx` | NEW: Reusable swipe-to-reveal action component |
| `frontend/src/components/ForkActionSheet.tsx` | NEW: Bottom sheet to confirm fork action |
| `src/app.ts` | New endpoints for session creation and fork operations |
| `src/rpc.ts` | Utilize `new_session` and `fork` RPC commands |

### Data Flow

**Session Creation:**
1. User taps "New Session" button on session list (always visible)
2. Bottom sheet appears with project selector (from existing projects)
3. User selects project → Sol spawns RPC with `new_session` command
4. New session opens in detail view with RPC connected

**Tree Access:**
1. Tree button available in all session detail views (not conditional)
2. For historical sessions: Uses SDK `sm.getTree()` via `/api/tree/:id`
3. For active sessions: Tree data derived from RPC `get_messages` response

**Fork from User Message:**
1. User swipes left on a **user message** entry (their prompts, not assistant responses)
2. SwipeableRow reveals "Fork" action button
3. User taps "Fork" → ForkActionSheet opens with confirmation
4. User confirms → RPC `fork` command sent with entry ID
5. Session "rewinds" to the fork point, ready for a new prompt direction

**Note:** Pi's RPC `fork` command only accepts user message entry IDs and does not support summarization options. The fork creates a branch point at the selected message, preserving full context up to that point.

### Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `SwipeableRow` | `ui/SwipeableRow.tsx` | Touch gesture handling with reveal threshold |
| `ForkActionSheet` | `ForkActionSheet.tsx` | Fork confirmation bottom sheet |
| `handleFork()` | `SessionDetail.tsx` | Sends fork command via RPC |
| `handleNewSession()` | `SessionList.tsx` | Spawns RPC and sends new_session command |
| `POST /api/session/:id/fork` | `app.ts` | Fork endpoint proxying to RPC |
| `POST /api/sessions/new` | `app.ts` | New session endpoint |

## Rationale

### Design Decisions

**Swipe-to-reveal pattern:**
- Standard iOS pattern (Mail, Messages) that users already understand
- Avoids cluttering the message view with always-visible buttons
- More discoverable than long-press (which has no visual affordance)
- Reveals actions in the direction of reading (left swipe → actions on right)

**Fork only on user messages:**
- Pi's `fork` RPC command only accepts user message entry IDs
- Semantically correct: you fork from a point where YOU said something, to try a different approach
- This matches pi's terminal `/tree` behavior

**Fork rewinds to branch point:**
- Pi's fork does not create a separate session file; it creates a branch point within the session
- After forking, the session view shows messages from start to the fork point
- User can continue the conversation in a new direction from there
- The tree view shows all branches, allowing navigation between them

**Tree access for all sessions:**
- Tree structure is valuable for understanding any session's history
- Previous restriction (only forked sessions) was arbitrary UX limitation
- SDK's `sm.getTree()` works for all sessions, not just forked ones

**Project selector for new sessions:**
- Reuses the project grouping already shown in session list
- Most common case: create new session in a project you're already working on
- Avoids complex directory picker UI on mobile
- "New Session" button always visible, even when session list is empty

### ADR References

- [ADR 005: Pi RPC Integration](../ADR/005-pi-rpc-integration.md) - `fork`, `new_session`, `switch_session` RPC commands
- [ADR 006: Tailwind v4 Design Tokens](../ADR/006-tailwind-v4-design-tokens.md) - UI primitive layer for SwipeableRow component

## Current Limitations

1. New session creation limited to projects with existing sessions (no arbitrary directory picker)
2. Swipe gesture respects iOS Safari back gesture (20px left margin buffer)
3. Fork requires RPC connection (not available for purely historical sessions)
4. Fork only available on user messages (pi RPC limitation)
5. Pi's fork command does not support summarization options
