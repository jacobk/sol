# Mobile Composer

## Overview

The Mobile Composer provides a full-screen prompt editing experience optimized for iPhone. It replaces the small inline input with an expansive text area, toolbar-triggered menus for inserting templates and file references, and readline-style history recall.

The simple inline input remains available for quick prompts, with an easy toggle to open the full composer when needed. This two-tier approach balances quick interactions with powerful composition capabilities.

## User Stories

From [PRD 001](../PRD/001-sol.md) Section 2.10:
- "As a developer, I want a full-screen prompt editor on mobile so I can compose complex prompts without struggling with a tiny input field."
- "As a developer, I want to browse and insert prompt templates so I can invoke skills and commands without memorizing syntax."
- "As a developer, I want to autocomplete file paths from my project so I can reference files without leaving the composer."
- "As a developer, I want to recall previous messages I've sent so I can reuse or modify past prompts."
- "As a developer, I want to toggle between the simple input and full composer so I can choose the right tool for the task."

## Implementation

### Key Files

| File | Purpose |
|------|---------|
| `frontend/src/components/MobileComposer.tsx` | Full-screen overlay with large textarea, toolbar, and picker sheets |
| `frontend/src/components/ComposerToolbar.tsx` | Toolbar with Templates/Files/History/Close buttons |
| `frontend/src/components/TemplatePickerSheet.tsx` | Bottom sheet for browsing skills and commands via RPC |
| `frontend/src/components/FilePickerSheet.tsx` | Bottom sheet for browsing git-tracked project files |
| `frontend/src/components/HistoryPickerSheet.tsx` | Bottom sheet for recalling previous user messages |
| `frontend/src/components/PromptInput.tsx` | Refactored with expand button, uses shared `usePromptState` |
| `frontend/src/hooks/usePromptState.ts` | Shared state hook for prompt text and delivery mode |
| `frontend/src/components/ui/SearchableList.tsx` | Reusable searchable list primitive |
| `frontend/src/components/ui/FullScreenOverlay.tsx` | Full-viewport modal with safe areas |
| `src/app.ts` | New endpoints: `/api/session/:id/commands`, `/api/files/:id/tree` |
| `src/files.ts` | New function: `getGitTrackedFiles()` |

### Data Flow

1. User taps expand icon on `PromptInput` → `setComposerOpen(true)` in SessionDetail
2. `MobileComposer` renders inside `FullScreenOverlay`, receives shared `promptState` via props
3. Current text already in `promptState.text` (shared between both inputs)
4. User composes prompt, optionally tapping toolbar buttons:
   - **Templates** → fetches `/api/session/:id/commands` (RPC `get_commands`) → `TemplatePickerSheet` displays in `SearchableList` → selection calls `insertAtCursor()` to insert at cursor position
   - **Files** → fetches `/api/files/:id/tree` (`git ls-files`) → `FilePickerSheet` displays paths → selection inserts `@filepath` at cursor
   - **History** → `HistoryPickerSheet` receives `historyMessages` prop (extracted from session entries) → selection calls `replaceText()` to replace entire content
5. User taps Send → `promptState.sendPrompt()` → POST to `/api/session/:id/prompt` → `onClose()` closes composer
6. Closing without sending preserves text in `promptState` for inline input

### Key Functions

- **`usePromptState(options)`** — Returns `{ text, setText, mode, setMode, sendState, canSend, sendPrompt, clear }`. Handles all prompt delivery logic.
- **`MobileComposer`** — Manages picker sheet visibility (`showTemplates`, `showFiles`, `showHistory`), provides `insertAtCursor()` and `replaceText()` handlers
- **`insertAtCursor(insertion: string)`** — Uses `textarea.selectionStart/End` to insert text at cursor position, preserves surrounding text
- **`ComposerToolbar`** — Renders four `IconButton` components with SVG icons for Templates, Files, History, Close
- **`TemplatePickerSheet`** — Fetches commands on first open (cached), formats as `/skill:name` or `/command`
- **`FilePickerSheet`** — Fetches file list on first open (cached), inserts as `@filepath`
- **`HistoryPickerSheet`** — Receives messages via props, sorts by timestamp descending, replaces text on selection

## Rationale

### Design Decisions

**Full-screen overlay vs. bottom sheet:**
A full-screen overlay provides maximum editing space without competing with the iOS keyboard. Bottom sheets struggle with keyboard interaction — when the keyboard opens, the sheet either gets pushed up (reducing usable space) or the content jumps unpredictably. Full-screen compose views are a familiar iOS pattern (Messages, Mail).

**Toolbar buttons vs. inline autocomplete:**
Inline autocomplete (typing `@` to trigger file completion) conflicts with mobile text selection gestures. The selection handles, magnifier, and autocorrect popover all compete for the same screen real estate. Explicit toolbar buttons are:
- More discoverable (users can see what's available)
- Touch-friendly (44pt tap targets)
- Non-conflicting (menus open in a separate layer)

**Bottom sheet menus for pickers:**
Once the composer is open, pickers use bottom sheets (not full-screen) because:
- Users should see their draft text while browsing options
- Quick selection doesn't need the full screen
- Swipe-to-dismiss is natural for "cancel" intent

**Per-session history:**
Message history is scoped to the current session for several reasons:
- No additional storage needed (derives from loaded messages)
- Contextually relevant (you want to recall what you said in *this* conversation)
- Privacy-preserving (no cross-session prompt leakage)

### ADR References

- [ADR 008: Mobile Composer Architecture](../ADR/008-mobile-composer-architecture.md) - Full architectural decision for overlay, toolbar, and picker approach
- [ADR 005: Pi RPC Integration](../ADR/005-pi-rpc-integration.md) - `get_commands` endpoint for templates, `prompt` command for sending
- [ADR 006: Tailwind v4 Design Tokens](../ADR/006-tailwind-v4-design-tokens.md) - Design system integration

## Current Limitations

> **Note:** This section is updated during implementation.

1. History is not persisted across app restarts (acceptable for MVP)
2. No fuzzy search for templates or files (simple substring match initially)
3. No drag-and-drop file insertion from Files app
4. No multi-selection from pickers (one item at a time)
5. No cursor position indicator in textarea (relies on native iOS behavior)
