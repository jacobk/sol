# ADR 008: Mobile Composer Architecture

**Date:** 2026-03-01
**Status:** Proposed
**Supersedes:** N/A

## Context

Sol's current prompt input is a simple auto-resizing textarea at the bottom of the session view. While functional, it has significant usability limitations on mobile:

1. **Limited editing space** — Complex prompts with code snippets or detailed instructions are difficult to compose in a 3-4 line textarea
2. **No template support** — Users must manually type or paste prompt templates and skill invocations
3. **No file completion** — Referencing project files requires memorizing paths or switching to the file inspector
4. **No history recall** — Previous prompts cannot be recalled; users must retype or copy from the conversation view
5. **Autocomplete friction** — Inline autocomplete menus on mobile are notoriously difficult to implement without blocking text selection or conflicting with iOS keyboard gestures

The pi CLI terminal provides `/skill` slash commands, `@`-completions for files, and readline history — features that significantly improve prompt composition ergonomics. Sol needs mobile equivalents.

## Decision

We will implement a **Mobile Composer** — a full-screen overlay editor that provides an enhanced prompt composition experience while maintaining the simple inline input for quick messages.

### Full-Screen Overlay Architecture

The composer will be a full-screen modal overlay (not a bottom sheet) to maximize editing space and avoid conflicts with the iOS keyboard.

**Key characteristics:**
- **Full viewport height** minus safe areas (notch, home indicator)
- **Dedicated toolbar** at the top with close, template, file, and history buttons
- **Large text area** occupying most of the screen
- **Sticky send button** at the bottom, above the keyboard
- **iOS keyboard optimization** — `inputmode="text"`, autocorrect/dictation enabled

**Why full-screen vs. bottom sheet:**
- Bottom sheets compete with the keyboard for space
- Bottom sheets require precise drag-to-dismiss gestures that conflict with text selection
- Full-screen provides consistent, predictable editing space
- iOS users are accustomed to full-screen compose views (Messages, Mail)

### Toolbar Action Menus

Instead of inline autocomplete that overlays the text, the composer uses **explicit toolbar buttons** that open **bottom sheet menus**:

| Button | Action | Menu Content |
|--------|--------|--------------|
| Templates | Opens template picker | List of skills from `get_commands` RPC, searchable |
| Files | Opens file picker | Git-tracked files from `/api/files/:id`, searchable |
| History | Opens history picker | Previous user messages in this session |
| Send | Submits prompt | N/A (direct action) |

**Why toolbar + bottom sheet vs. inline autocomplete:**
- Inline autocomplete on mobile conflicts with text selection gestures
- Explicit buttons are easier to tap than typing trigger characters (`/`, `@`)
- Bottom sheet menus support search and scrolling better than overlays
- Users can browse available options without committing to typing
- Selection from menu inserts text at cursor position

### Template Integration

Templates are fetched via the existing `get_commands` RPC endpoint which returns skills and slash commands.

**Insertion behavior:**
1. User taps "Templates" button
2. Bottom sheet opens with searchable list of skills/commands
3. User taps a template
4. Template content (skill invocation or command) is inserted at cursor position
5. Menu closes, cursor positioned after insertion

### File Completion

Project files are fetched via git-tracked file listing (extending the existing `/api/files/:id` endpoint or adding a new `/api/files/:id/list` for complete project file tree).

**Insertion behavior:**
1. User taps "Files" button
2. Bottom sheet opens with searchable file tree
3. User taps a file
4. File path is inserted at cursor position (optionally wrapped in backticks or as `@filename`)
5. Menu closes, cursor positioned after insertion

### History Management

Message history is maintained **per-session** in the frontend state. When the user opens the history picker:

1. Previous user messages from the current session are displayed (most recent first)
2. User taps a message to insert it (replacing current content) or long-press to append
3. History is populated from the existing session messages (already loaded for conversation view)

**No server storage** — history is derived from session messages already in memory.

### Mode Toggle

Users can toggle between the simple inline input and the full composer:

- **Expand button** on the inline input opens the composer (transfers current text)
- **Collapse button** on the composer closes it (transfers text back to inline input)
- **Send from either mode** — both inputs can send prompts directly

## Consequences

### Positive

- **Superior editing experience** — Large, stable text area matches native compose views
- **Discoverable features** — Toolbar buttons make templates, files, and history visible
- **Touch-friendly** — Bottom sheet menus avoid inline overlay gesture conflicts
- **Incremental adoption** — Simple input remains for quick prompts
- **No new backend infrastructure** — Uses existing RPC commands and file APIs

### Negative

- **Two code paths** — Must maintain both inline input and composer components
- **Mode switching friction** — Users must consciously switch to access advanced features
- **History limits** — Per-session history doesn't persist across app restarts (acceptable)

### Technical

- New component: `MobileComposer.tsx` (full-screen overlay)
- New component: `ComposerToolbar.tsx` (template/file/history buttons)
- New component: `TemplatePickerSheet.tsx` (bottom sheet for templates)
- New component: `FilePickerSheet.tsx` (bottom sheet for files)
- New component: `HistoryPickerSheet.tsx` (bottom sheet for history)
- Extend `PromptInput.tsx` with expand button to open composer
- May need new endpoint `/api/session/:id/files/tree` for full project file listing

### Maintainability

- **Shared text handling** — Both input modes should share the same text state and send logic to avoid duplication
- **Bottom sheet primitive** — Add generic `BottomSheet` component to design system for reuse
- **Searchable list primitive** — Add generic `SearchableList` component for template/file/history pickers
- **Testing** — Each picker can be unit tested independently; integration tests verify insertion behavior
