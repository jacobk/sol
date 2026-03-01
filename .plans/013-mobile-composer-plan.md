# TICKET-013: Mobile Composer

## Objective

Implement a full-screen prompt editor with template picker, file completion, and history recall for enhanced mobile prompt composition.

## Key Findings

- **BottomSheet.tsx already exists** — Full Headless UI implementation with backdrop, animations, and safe areas. No need to create from scratch, but may need minor enhancements (e.g., larger max-height for file picker).
- **PromptInput.tsx** has standalone state — Text/mode managed internally. Need to lift state to enable sharing with composer.
- **No `/api/session/:id/commands` endpoint** — Must add backend route to fetch skills/commands via RPC `get_commands`.
- **No full file listing endpoint** — `/api/files/:id` returns only git-modified files. Need new endpoint for `git ls-files` to list all tracked files.
- **SessionDetail.tsx owns prompt interaction** — Holds `isStreaming`, `handleAbort`, etc. Good place to lift shared prompt state.
- **Existing patterns**: Dialog/BottomSheet use Headless UI + Transition. All touch targets use `var(--spacing-touch)`. Design tokens in Tailwind CSS variables.
- **User messages extraction** — `SessionDetail.tsx` already has `data.entries` with all messages. Can filter for `role === "user"` for history.

## Tasks

- [x] **1. Backend: Add commands endpoint** — `src/app.ts`
  Add `GET /api/session/:id/commands` that sends `get_commands` RPC and returns skills/commands list.

- [x] **2. Backend: Add file tree endpoint** — `src/app.ts`, `src/files.ts`
  Add `GET /api/session/:id/files/tree` using `git ls-files` to return all tracked files in the project.

- [x] **3. Create SearchableList primitive** — `frontend/src/components/ui/SearchableList.tsx`
  Reusable list with search input, scrollable items, and selection callback. Export from `ui/index.ts`.

- [x] **4. Create FullScreenOverlay primitive** — `frontend/src/components/ui/FullScreenOverlay.tsx`
  Full-viewport modal with safe area insets, close callback. Uses Headless Dialog. Export from `ui/index.ts`.

- [x] **5. Create usePromptState hook** — `frontend/src/hooks/usePromptState.ts`
  Shared state hook for prompt text, delivery mode, send function. Used by both PromptInput and MobileComposer.

- [x] **6. Create ComposerToolbar** — `frontend/src/components/ComposerToolbar.tsx`
  Horizontal toolbar with IconButtons: Templates, Files, History, Close. Opens corresponding picker sheets.

- [x] **7. Create TemplatePickerSheet** — `frontend/src/components/TemplatePickerSheet.tsx`
  BottomSheet with SearchableList showing skills/commands. Fetches from `/api/session/:id/commands`. Emits selected text.

- [x] **8. Create FilePickerSheet** — `frontend/src/components/FilePickerSheet.tsx`
  BottomSheet with SearchableList showing project files. Fetches from `/api/session/:id/files/tree`. Emits file path.

- [x] **9. Create HistoryPickerSheet** — `frontend/src/components/HistoryPickerSheet.tsx`
  BottomSheet with SearchableList showing user messages from session. No fetch needed — derives from props.

- [x] **10. Create MobileComposer** — `frontend/src/components/MobileComposer.tsx`
  FullScreenOverlay with large textarea, ComposerToolbar, send button. Uses usePromptState hook. Manages cursor position for insertions.

- [x] **11. Refactor PromptInput** — `frontend/src/components/PromptInput.tsx`
  Add expand button (icon) to open MobileComposer. Accept shared state via props from usePromptState hook.

- [x] **12. Integrate in SessionDetail** — `frontend/src/components/SessionDetail.tsx`
  Add usePromptState hook at top level. Pass state to PromptInput. Add MobileComposer with isOpen state. Pass user messages for history.

- [x] **13. Add unit tests** — `src/app.test.ts`, `src/files.test.ts`
  Tests for new backend endpoints (commands, files/tree) and getGitTrackedFiles function.

- [x] **14. Update design system docs** — `docs/features/design-system.md`
  Document SearchableList and FullScreenOverlay primitives with usage examples.

- [x] **15. Update feature docs** — `docs/features/mobile-composer.md`
  Complete Implementation section with key files, data flow, and key functions.

## Bug Fixes

### Template Picker "No templates found" — NEEDS FIX

**Problem:**
1. RPC `get_commands` returns `{ data: { commands: RpcSlashCommand[] } }` with each command having a `source` field
2. Frontend expects `{ skills: [...], commands: [...] }` — completely wrong structure
3. Result: always shows "No templates found" because `data.skills` and `data.commands` are undefined

**Root cause in `TemplatePickerSheet.tsx`:**
```typescript
// WRONG: expects this structure
interface CommandsResponse {
  skills?: CommandItem[];
  commands?: CommandItem[];
}

// ACTUAL RPC response structure (from pi-agent rpc-types.d.ts):
{
  type: "response",
  command: "get_commands", 
  success: true,
  data: {
    commands: RpcSlashCommand[]  // Array with source field per item
  }
}

interface RpcSlashCommand {
  name: string;
  description?: string;
  source: "extension" | "prompt" | "skill";
  location?: "user" | "project" | "path";
  path?: string;
}
```

**Fix required:**
1. Update `CommandsResponse` interface to match actual RPC response structure
2. Parse `data.commands` array — all items are templates/commands, no need to filter by source
3. Replace `SearchableList` with a filterable dropdown list

### UI Change: Dropdown Instead of Search

**Current:** SearchableList with separate search input above scrollable list  
**Desired:** Simple scrollable list with inline filter input at top (autocomplete style)

**Implementation approach:**
- Keep BottomSheet for the container
- Replace SearchableList with a custom filterable list:
  - Filter input at top (optional, can add later if list gets long)
  - Scrollable list of templates below
  - Click to select, no separate search UI
- For MVP: just show scrollable list without filter (most projects have <20 templates)

## Tasks (Bug Fixes)

- [x] **16. Fix TemplatePickerSheet data parsing** — `frontend/src/components/TemplatePickerSheet.tsx`
  Update interfaces to match actual RPC response: `{ type, command, success, data: { commands: Array<{name, description, source, location?, path?}> } }`. Access `data.commands` instead of top-level `skills`/`commands`.

- [x] **17. Replace SearchableList with simple list** — `frontend/src/components/TemplatePickerSheet.tsx`
  Replace `SearchableList` with a simple scrollable list of buttons. Show all templates directly. Add optional filter input at top (only shown when >5 templates) that filters inline (autocomplete style). Format: `/name` for prompts, `/skill:name` for skills. Shows source badge (skill/prompt/ext).

## Verification

```bash
npm run build   # TypeScript compilation
npm test        # Unit and integration tests
```

Manual verification on iPhone Safari:
- Expand button opens full-screen composer
- Toolbar buttons open picker sheets
- **Template picker shows all prompt templates and skills from pi-agent**
- **Template picker is a dropdown with autocomplete filter**
- Template/file selection inserts at cursor
- History selection replaces text
- Send from composer works and closes
- Close button returns text to inline input
- Keyboard doesn't overlap send button
