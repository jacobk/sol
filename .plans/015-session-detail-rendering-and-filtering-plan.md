# TICKET-015: Session Detail Rendering Consistency and Conversation Filtering

## Objective
Fix message collapse behavior, make thinking always visible, and add conversation filtering to match pi CLI.

## Key Findings
- `shouldCollapseByDefault()` at line 240 collapses assistant messages if >300 chars — needs to return `false` for user/assistant
- `ContentBlocks` at line 405 has conditional thinking collapse (lines 424-451) — needs to always show inline
- `toolbarActions` at line 1509 builds toolbar — add filter selector here
- Streaming messages in `StreamingMessage.tsx` use same `ChatBubble` component, consistency likely OK
- `StreamingMessageBubble` doesn't show thinking at all during streaming — may need fix
- Toolbar accepts `actions` array with `{key, label, onClick, variant?, disabled?}`

## Tasks

- [x] **1. Fix shouldCollapseByDefault** — `frontend/src/components/SessionDetail.tsx:240-270`
  Change: user/assistant return `false`, keep tool/bash/summary returning `true`

- [x] **2. Remove thinking collapse logic** — `frontend/src/components/SessionDetail.tsx:420-452`
  Remove the `isLong` conditional and `<details>` wrapper, always render inline

- [x] **3. Add filter type and state** — `frontend/src/components/SessionDetail.tsx`
  Add: `type ConversationFilter`, `useState<ConversationFilter>("default")` near other state

- [x] **4. Create filterEntries function** — `frontend/src/components/SessionDetail.tsx`
  Add function that filters entries based on filter mode before rendering

- [x] **5. Apply filter in render loop** — `frontend/src/components/SessionDetail.tsx:~1600`
  Replace `data.entries.map()` with `filterEntries(data.entries, filter).map()`

- [x] **6. Add filter pill to header** — `frontend/src/components/SessionDetail.tsx`
  Added tappable filter pill in header that opens BottomSheet selector (removed from toolbar to avoid menu being too wide)

- [x] **7. Add filter selection BottomSheet** — `frontend/src/components/SessionDetail.tsx`
  BottomSheet with options: All, No Tools, User, Labeled. Active filter shown with accent color.

- [x] **8. Verify streaming thinking visibility** — `frontend/src/components/StreamingMessage.tsx`
  Added thinking content display during streaming

- [x] **9. Build and test** — run `npm run build && npm test`
  Verify no TypeScript errors, all tests pass

## Verification
- `npm run build` — must pass with no errors
- `npm test` — must pass
- Manual: Load session → user/assistant messages expanded
- Manual: Send prompt via active session → message renders same as historical
- Manual: Apply filters → correct entries shown/hidden
- Manual: Thinking always visible inline
