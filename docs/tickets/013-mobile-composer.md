# TICKET-013: Mobile Composer

**Related:** ADR 008, PRD Section 2.10, PRD Section 3.11
**Feature:** Mobile Composer
**Status:** Changes Required
**Created:** 2026-03-01

## Context to Load

Files the implementation agent MUST read first:

1. `docs/ADR/008-mobile-composer-architecture.md` - Full architectural decisions for overlay, toolbar, and picker approach
2. `docs/PRD/001-sol.md` Section 2.10 & 3.11 - User stories and functional requirements
3. `docs/features/mobile-composer.md` - Feature overview and design rationale
4. `docs/features/design-system.md` - Design tokens and component primitives
5. `frontend/src/components/PromptInput.tsx` - Existing prompt input to extend
6. `frontend/src/components/ui/` - Existing UI primitives to follow patterns

## Implementation Checklist

### 1. Design System Extensions

Add new UI primitives to `frontend/src/components/ui/`:

- **BottomSheet.tsx:** Reusable slide-up sheet with drag-to-dismiss, backdrop, animation. Use Headless UI Dialog or custom implementation. Must handle iOS safe areas.
- **SearchableList.tsx:** List with search input at top, scrollable items, selection callback. Use for template/file/history pickers.
- **FullScreenOverlay.tsx:** Full-viewport modal with safe area insets. Base for the composer.

Follow design tokens from ADR 006 and design-system.md. Update design-system.md with new primitives documentation.

### 2. Mobile Composer Core

Create `frontend/src/components/MobileComposer.tsx`:

- Full-screen overlay using FullScreenOverlay primitive
- Large auto-resizing textarea (similar to PromptInput but larger)
- ComposerToolbar at top with action buttons
- Send button at bottom, sticky above keyboard
- Manages text state and cursor position
- Receives initial text from inline input on open
- Returns text to inline input on close (without sending)

### 3. Composer Toolbar

Create `frontend/src/components/ComposerToolbar.tsx`:

- Horizontal toolbar with icon buttons: Templates, Files, History, Close
- Each button opens corresponding picker bottom sheet
- Follow 44pt minimum touch targets
- Use IconButton primitive from design system

### 4. Template Picker Sheet

Create `frontend/src/components/TemplatePickerSheet.tsx`:

- Fetch skills/commands via existing `/api/session/:id/commands` endpoint (uses `get_commands` RPC)
- Display in SearchableList with search filtering
- On selection, emit selected template text
- Composer inserts at cursor position

### 5. File Picker Sheet

Create `frontend/src/components/FilePickerSheet.tsx`:

- Fetch project files (may need new endpoint or extend `/api/files/:id`)
- Display as searchable file tree or flat list
- On selection, emit file path
- Composer inserts path at cursor position

### 6. History Picker Sheet

Create `frontend/src/components/HistoryPickerSheet.tsx`:

- Extract user messages from session state (already loaded)
- Display in SearchableList, most recent first
- On tap: replace composer text with selected message
- On long-press (optional): append to composer text

### 7. Extend PromptInput

Update `frontend/src/components/PromptInput.tsx`:

- Add expand icon button to open MobileComposer
- Share text state with composer (lift state to parent or use context)
- When composer opens, transfer current text
- When composer closes, receive text back

### 8. API Extension (if needed)

If current file APIs don't provide full project file listing:

- Add `GET /api/session/:id/files/tree` endpoint
- Returns all git-tracked files in the session's cwd
- Use `git ls-files` or similar

## Maintainability

Before implementing, review for:

- [x] **Refactor opportunity?** PromptInput and MobileComposer should share text state management
- [x] **DRY check** - SearchableList can be reused across all three pickers
- [x] **Modularity** - Each picker sheet should be independently testable
- [x] **Debt impact** - New primitives (BottomSheet, SearchableList) reduce future debt

**Specific refactoring tasks:**
- Extract shared prompt text state into a custom hook or context provider
- Ensure BottomSheet primitive is generic enough for future uses (model switcher, etc.)

## Testing Requirements

### Unit Tests

- `BottomSheet.test.tsx` - Open/close states, backdrop interaction
- `SearchableList.test.tsx` - Filtering, selection callbacks
- `MobileComposer.test.tsx` - Text state management, toolbar interactions
- `TemplatePickerSheet.test.tsx` - Data fetching, selection insertion
- `FilePickerSheet.test.tsx` - Data fetching, path formatting
- `HistoryPickerSheet.test.tsx` - Message extraction, selection modes

### Integration Tests

- Composer ↔ PromptInput text transfer
- Template insertion at cursor position
- File path insertion formatting
- History replacement and append modes

### Verification Checklist

Implementation agent MUST run before marking complete:
```bash
npm run build  # Must pass
npm test       # Must pass
```

## Acceptance Criteria

- [ ] Expand button on PromptInput opens MobileComposer overlay
- [ ] MobileComposer provides full-screen text editing with iOS keyboard support
- [ ] Templates button opens bottom sheet with searchable skills/commands list
- [ ] Selecting a template inserts it at cursor position
- [ ] Files button opens bottom sheet with searchable project file list
- [ ] Selecting a file inserts its path at cursor position
- [ ] History button opens bottom sheet with previous user messages
- [ ] Selecting a history item replaces or appends to composer text
- [ ] Send button submits prompt and closes composer
- [ ] Close button returns to session view with text preserved in inline input
- [ ] All new components use design system tokens (no hardcoded colors)
- [ ] All touch targets are minimum 44x44pt
- [ ] BottomSheet and SearchableList primitives added to design system docs

## Files to Modify

| File | Change |
|------|--------|
| NEW: `frontend/src/components/ui/BottomSheet.tsx` | Reusable bottom sheet primitive |
| NEW: `frontend/src/components/ui/SearchableList.tsx` | Reusable searchable list primitive |
| NEW: `frontend/src/components/ui/FullScreenOverlay.tsx` | Full-screen modal primitive |
| NEW: `frontend/src/components/MobileComposer.tsx` | Main composer component |
| NEW: `frontend/src/components/ComposerToolbar.tsx` | Toolbar with action buttons |
| NEW: `frontend/src/components/TemplatePickerSheet.tsx` | Template selection bottom sheet |
| NEW: `frontend/src/components/FilePickerSheet.tsx` | File selection bottom sheet |
| NEW: `frontend/src/components/HistoryPickerSheet.tsx` | History recall bottom sheet |
| `frontend/src/components/PromptInput.tsx` | Add expand button, share text state |
| `docs/features/design-system.md` | Document new primitives |
| `docs/features/mobile-composer.md` | Complete Implementation section |
| MAYBE: `src/app.ts` | Add `/api/session/:id/files/tree` if needed |

## Notes

- Do NOT duplicate ADR/PRD content - reference it
- Follow the terminal aesthetic from ADR 006 - no heavy borders or chat bubbles in the composer
- Ensure bottom sheets respect iOS safe areas (notch, home indicator)
- Test on actual iPhone Safari to verify keyboard interaction
- Consider using Headless UI's Dialog/Transition for animations

---

## Review Feedback

**Reviewed:** 2026-03-01  
**Result:** ❌ Changes Required — 3 blocking issues, 1 advisory

### ✅ What Passes

- `npm run build` passes with zero TypeScript errors (backend + frontend)
- `npm test` passes — all 103 tests green
- All new backend endpoints (`GET /api/session/:id/commands`, `GET /api/files/:id/tree`) are correctly implemented with proper error handling, status codes, and timeout/cleanup for the RPC event listener
- `getGitTrackedFiles()` in `src/files.ts` is clean, handles non-git directories gracefully, has a 5 MB buffer guard
- Backend tests for new endpoints are thorough in `app.test.ts` and `files.test.ts`
- `usePromptState` hook correctly extracts all send logic; DRY — no duplication between `PromptInput` and `MobileComposer`
- `FullScreenOverlay` correctly uses `env(safe-area-inset-*)` for iOS notch/home-bar, Headless UI `Dialog` + `Transition` for accessibility and animation
- `SearchableList` uses design system `Input` primitive and semantic tokens
- All components consistently use `var(--spacing-touch)` for 44pt touch targets
- No hardcoded hex values — `bg-black/80` on the backdrop is consistent with the pre-existing `BottomSheet.tsx` pattern and acceptable for overlays
- `PromptInput` refactor is clean: no logic duplication, expand button uses `IconButton` primitive
- `historyMessages` extraction in `SessionDetail` correctly derives from already-loaded session entries — no extra fetch
- Picker sheets use `BottomSheet` + `SearchableList` primitives as required
- PRD Sections 2.10 and 3.11 added, ADR 008 created, feature doc written, feature index updated, `prompt-and-streaming.md` cross-reference added — documentation workflow followed
- No modifications to historical session files; no authentication added; no orphaned processes

---

### ❌ Blocking Issue 1 — Frontend Tests Missing

**Severity:** Blocking  
**Constitution Rule 10 / Ticket "Testing Requirements"**

The ticket explicitly mandates the following test files. **None of them exist:**

| Required Test File | Status |
|---|---|
| `BottomSheet.test.tsx` | ❌ Missing |
| `SearchableList.test.tsx` | ❌ Missing |
| `MobileComposer.test.tsx` | ❌ Missing |
| `TemplatePickerSheet.test.tsx` | ❌ Missing |
| `FilePickerSheet.test.tsx` | ❌ Missing |
| `HistoryPickerSheet.test.tsx` | ❌ Missing |

The ticket also requires **integration tests** covering:
- Composer ↔ PromptInput text transfer
- Template insertion at cursor position
- File path insertion formatting (`@filepath`)
- History replacement behaviour

There are no frontend test files at all in `frontend/src/` — no test framework setup, no existing component tests to follow. Before writing the tests, the implementation agent must first set up a frontend test runner (e.g. Vitest + jsdom/happy-dom + preact-testing-library) or confirm that frontend tests are expected to run in the existing Vitest config. Check `vitest.config.ts` and determine whether the frontend tests should live alongside backend tests or in a separate `frontend/` workspace.

**Required fix:** Add all 6 unit test files plus integration test coverage. Run `npm test` to confirm all pass.

---

### ❌ Blocking Issue 2 — Unwarranted Side Effect: `.gitignore` change

**Severity:** Blocking  
**Constitution Rule 4: "Features must only implement the specific behavior outlined in their PRD, ticket, and plan. Do not introduce refactors or unrelated changes."**

The diff removes `.plans` from `.gitignore`:

```diff
-.plans
```

This is not mentioned in the ticket, PRD, or ADR. Removing `.plans` from `.gitignore` would cause the implementation plan directory to be tracked by git — an unrelated change with potential project-wide effects. This must be reverted.

**Required fix:** Restore `.plans` to `.gitignore`.

---

### ❌ Blocking Issue 3 — Stale Data Cache Bug in Picker Sheets

**Severity:** Blocking (correctness defect)

Both `TemplatePickerSheet` and `FilePickerSheet` use a cache guard that can serve stale data when `sessionId` changes:

```typescript
// TemplatePickerSheet — line ~52
if (commands.length > 0) return; // Already loaded

// FilePickerSheet — line ~42
if (files.length > 0) return; // Already loaded
```

The `useEffect` dependency arrays include `sessionId`, `commands.length` / `files.length`, and `open`. When the session ID changes while commands are already cached (e.g. user navigates from session A to session B while the sheet is open, or reopens the composer on a different session), the guard fires immediately and returns the previous session's data because `commands.length > 0` is still true. The correct guard should invalidate the cache when `sessionId` changes.

**Required fix:** Either:
- Track the session ID for which data was loaded and invalidate if it differs:
  ```typescript
  const [loadedForSession, setLoadedForSession] = useState<string | null>(null);
  if (open && loadedForSession === sessionId) return; // Already loaded for this session
  ```
- Or reset the cached data on `sessionId` change via a separate `useEffect`.

This fix applies identically to `TemplatePickerSheet.tsx` and `FilePickerSheet.tsx`.

---

### ⚠️ Advisory — Feature README status is "Planned"

**Severity:** Advisory (not blocking)

`docs/features/README.md` lists Mobile Composer as `Planned`:

```
| Mobile Composer | [mobile-composer.md](mobile-composer.md) | Planned | 005, 006, 008 |
```

Once the blocking issues above are resolved and the feature is accepted, this should be updated to `Implemented` (or whatever status convention the project uses for shipped features). Not blocking review, but should be addressed before closing the ticket.

---

### Summary Table

| Check | Result |
|---|---|
| Ticket checklist complete | ✅ (except tests) |
| Acceptance criteria met | ⚠️ Partial — tests missing |
| PRD/ADR alignment | ✅ |
| No unwarranted side effects | ❌ `.gitignore` change |
| AGENTS.md compliance | ✅ |
| Constitution compliance | ❌ Missing tests; unwarranted side effect |
| `npm run build` | ✅ |
| `npm test` | ✅ (backend only) |
| Frontend tests | ❌ None exist |
| No hardcoded colors | ✅ |
| Touch targets ≥ 44pt | ✅ |
| Correctness | ❌ Stale cache bug in pickers |
