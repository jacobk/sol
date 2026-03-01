# TICKET-012: UX Overhaul — Message Rendering, Toolbar, Scrolling & Collapsibles

**Related:** ADR 006, PRD Section 2.8, PRD Section 3.2
**Feature:** UX Overhaul (`docs/features/ux-overhaul.md`)
**Status:** In Review
**Created:** 2026-03-01

## Context to Load

1. `docs/features/ux-overhaul.md` — Full feature rationale and design decisions
2. `docs/PRD/001-sol.md` Section 2.8 — User stories for UX polish
3. `docs/PRD/001-sol.md` Section 3.2 — Conversation view requirements
4. `docs/ADR/006-tailwind-v4-design-tokens.md` — Token system to follow
5. `frontend/src/components/SessionDetail.tsx` — Primary file to overhaul
6. `frontend/src/components/StreamingMessage.tsx` — Streaming message rendering
7. `frontend/src/components/ui/ChatBubble.tsx` — Current message container
8. `frontend/src/components/PromptInput.tsx` — Fixed bottom input (scroll offset source)

## Implementation Checklist

### 1. Terminal-Style Markdown Renderer

Create a `MarkdownRenderer` component that uses `marked` to parse markdown and renders it with terminal-inspired CSS styling (`.prose-terminal` class). Must handle: headings, bold/italic, inline code, fenced code blocks, lists, links, blockquotes. Style with semantic design tokens (no hardcoded hex). Apply to all assistant message text content and streaming message text content. Do not use icons anywhere.

### 2. Unified Message Rendering — Eliminate Empty Bubbles

Audit `renderMessageEntry` and `renderEntry` in `SessionDetail.tsx`. Skip rendering assistant entries where content is empty or contains only tool calls with no text blocks. Ensure `isRenderable` correctly filters these. Each logical message appears exactly once in the view.

### 3. Subtle Chat-Style Alignment

Rework `ChatBubble.tsx` to support alignment. User messages: slightly offset right (e.g., `ml-8` or `ml-6`), distinct but subtle background tint. Agent/assistant messages: full width, left-aligned. No icons for role indication — use a small text label (e.g., "You", "Agent") and the positional alignment. Tool results, system messages, and bash remain full-width left-aligned with their current role-colored left border. Keep spacing tight — no wasted whitespace.

### 4. Floating Collapsible Toolbar

Replace the current header action row (Connect, Files, Model, Tree, Expand/Collapse) with a floating toolbar component. Requirements:
- Positioned top-right, floating over content (`position: fixed` or `sticky`).
- Pill-shaped, semi-transparent background (e.g., `bg-surface-2/90 backdrop-blur`).
- Shows actions as compact text labels (no icons).
- Collapsible to a single small toggle button.
- Keep the back button and session title in a minimal sticky header.
- Ensure z-index layering works with the bottom prompt input.

### 5. Smart Auto-Scroll Hook

Create a `useAutoScroll` hook extracted from `SessionDetail.tsx`. Logic:
- **Auto-scroll ON** by default when entering a session.
- **Auto-scroll pauses** when user scrolls up (detect scroll direction via `scrollTop` delta).
- **Auto-scroll resumes** when user taps "scroll to bottom" or manually scrolls to near-bottom.
- Expose: `{ isAutoScrolling, scrollToBottom, onContentChange }`.

### 6. Scroll-to-Bottom & New Messages Pill

- Scroll-to-bottom button: visible whenever the user is NOT at the bottom (remove the "2 screens away" threshold). Hidden only when at the very bottom.
- When auto-scroll is paused and new streaming content arrives, show a floating "New messages ↓" pill above the prompt input. Tapping it scrolls to bottom and re-enables auto-scroll.
- Position the scroll button above the prompt input when connected (currently `bottom-20`, verify this is correct).

### 7. Bottom Padding — No Hidden Content

Ensure the message list has enough bottom padding to account for the fixed `PromptInput` height. Currently uses `pb-24` on the bottom ref div only when RPC-connected — verify this is sufficient. If `PromptInput` height changes (e.g., multi-line), the padding must adapt. Consider measuring the prompt input element's height dynamically or using a generous fixed value.

### 8. Inline Expand/Collapse UX

Rework `CollapsibleEntry`:
- **Collapsed state:** Tap anywhere on the collapsed preview to expand (current behavior — keep).
- **Expanded state:** Add a sticky/visible collapse bar at the **top** of the expanded content. This bar should contain the role label and a "Collapse" action. It stays visible when scrolling within a long expanded message. Keep the bottom "▲ Less" button as a secondary affordance but the primary collapse mechanism is the top bar.
- Remove emoji from the Copy/Collapse controls — use text only.

### 9. Tool Rendering System (Updated: 2026-03-01)

Based on research in `docs/research/tool-rendering-research.md`, implement a **unified per-tool rendering system** matching pi-coding-agent's approach.

#### Phase 1: Bash Execution (Done)
Rework `bashExecution` case with `BashExecutionBubble`:
- Command with `$ ` prefix, prominent monospace display
- Output preview (4 lines) in muted color
- Expand/collapse with "N more lines — tap to expand"
- Status badges for exit code, cancelled, truncated

#### Phase 2: ToolResult Rendering (Pending)
Create `ToolResultBubble` component with per-tool formatting based on `toolName`:

| Tool | Header Format | Preview Lines | Special Handling |
|------|---------------|---------------|------------------|
| `read` | `read {path}:range` | 10 | Parse path from content |
| `write` | `write {path}` | 10 | Parse path, show line count |
| `edit` | `edit {path}:line` | Full | Render as unified diff |
| `ls` | `ls {path}` | 20 | Directory listing style |
| `find` | `find {pattern} in {path}` | 20 | File list |
| `grep` | `grep /{pattern}/ in {path}` | 15 | Match results |
| Other | `{toolName}` | 10 | Generic content preview |

**Data limitation:** `toolResult` entries don't include original arguments. Parse path/pattern from content text where possible.

#### Phase 3: Syntax Highlighting (Future)
Add syntax highlighting for code content in read/write results based on file extension.

The goal: users can quickly scan what tools ran and their outcomes, matching the pi CLI aesthetic.

## Maintainability

Before implementing, review for:

- [x] **Refactor opportunity?** `ChatBubble` role styles, `CollapsibleEntry`, and scroll logic are candidates for extraction into reusable hooks/components.
- [x] **DRY check** — Auto-scroll logic is currently duplicated between `handleStreamActivity`, `handleNewStreamingMessage`, and the scroll event listener. Unify into the `useAutoScroll` hook.
- [x] **Modularity** — Markdown renderer, auto-scroll hook, and toolbar are independently testable units.
- [x] **Debt impact** — This reduces UX debt (empty bubbles, broken scrolling, cluttered toolbar) significantly.

**Specific refactoring tasks:**
- Extract auto-scroll logic from `SessionDetail.tsx` into `frontend/src/hooks/useAutoScroll.ts`.
- Extract markdown rendering into `frontend/src/components/ui/MarkdownRenderer.tsx` — reusable for file viewer markdown too.
- Consolidate `ChatBubble` role styling with the new alignment logic — avoid separate style maps.

## Testing Requirements

### Verification Checklist

Implementation agent MUST run before marking complete:
```bash
npm run build  # Must pass
npm test       # Must pass
```

### Manual Verification

- Open a session with mixed message types — no empty assistant bubbles visible.
- User messages subtly right-aligned, agent messages left-aligned.
- Markdown in assistant messages renders with styled headings, code blocks, lists.
- Toolbar collapses/expands smoothly. All actions accessible.
- Scroll to bottom of a long session — prompt input doesn't obscure messages.
- Connect to active session — new streaming messages auto-scroll. Scroll up — auto-scroll pauses. Floating pill appears on new content.
- Tap scroll-to-bottom — reaches bottom. Button hides at bottom.
- Expand a long message — collapse bar visible at top without scrolling. Tap to collapse.

## Acceptance Criteria

- [x] No empty assistant message bubbles rendered in the conversation view.
- [x] Assistant text content renders parsed markdown with terminal-style CSS (headings, code blocks, lists, bold, links).
- [x] User messages are subtly right-aligned; agent messages left-aligned; no icons used for role indication.
- [x] Floating toolbar with all session actions, collapsible to a toggle button.
- [x] Auto-scroll follows new messages; pauses on manual scroll-up; "New messages" pill re-enables it.
- [x] Scroll-to-bottom button visible whenever not at the bottom (no 2-screen threshold).
- [x] No messages hidden behind the fixed prompt input.
- [x] Expanded messages have a visible collapse control at the top of the content.
- [x] All semantic design tokens used — no hardcoded hex or raw Tailwind color values in feature code.
- [x] `npm run build && npm test` passes.
- [x] Bash executions show command prominently with output preview (Phase 1 complete).
- [x] Tool results (read/write/edit/ls/find/grep) render with per-tool formatting (Phase 2 complete).
- [x] Terminal aesthetic: no heavy chat bubbles, no nested boxes, inline text styling (Phase 3 complete).
- [x] Controls hidden until needed: Copy/Less buttons removed from CollapsibleEntry.
- [x] Tighter spacing: reduced gaps and padding throughout.
- [x] Typography-driven hierarchy: thinking italic, tool calls monospace/accent.
- [x] ANSI escape sequences stripped from bash output and tool results.
- [x] Thinking text renders inline (short) or collapsible preview (long), matching pi CLI.
- [x] No redundant labels — conversation flow is self-evident without "AGENT" labels everywhere.
- [x] Overflow handled properly — page never scrolls horizontally, content scrolls in containers.
- [x] Full content always viewable — via word-wrap for prose, horizontal scroll for code/output.
- [ ] Code content in read/write results has syntax highlighting (Future enhancement).

## Files to Modify

| File | Change |
|------|--------|
| `frontend/src/components/SessionDetail.tsx` | Overhaul toolbar, scroll logic, entry rendering, bottom padding |
| `frontend/src/components/StreamingMessage.tsx` | Apply markdown renderer to streaming text |
| `frontend/src/components/ui/ChatBubble.tsx` | Add alignment support, rework role styles |
| NEW: `frontend/src/components/ui/Toolbar.tsx` | Floating collapsible toolbar component |
| NEW: `frontend/src/components/ui/MarkdownRenderer.tsx` | Terminal-style markdown rendering |
| NEW: `frontend/src/hooks/useAutoScroll.ts` | Smart auto-scroll hook |
| NEW: `frontend/src/utils/text.ts` | Text utilities — ANSI stripping |
| `frontend/src/index.css` | Markdown prose styles, long line handling |

## Review Results (2026-03-01)

**Verdict: PASSING** — All acceptance criteria met, `npm run build && npm test` clean (91/91). No constitution rules broken.

### ✅ Phase 1-2 Passing

- Terminal-style `MarkdownRenderer` with `marked` + DOMPurify, semantic tokens throughout.
- Empty assistant bubbles eliminated via `isRenderable()` + `assistantHasTextContent()`.
- `ChatBubble` alignment (`ml-6` user / full-width agent), text-only role labels, no icons.
- `Toolbar.tsx` floating collapsible pill — correct z-index layering, text-only actions.
- `useAutoScroll` hook correctly extracted — pause/resume on scroll, `scrollDelta` detection.
- "New messages" pill and scroll-to-bottom button positioned and behaving per spec.
- `pb-28` / `pb-4` bottom padding prevents content hidden behind prompt input.
- `CollapseBar` sticky at top of expanded messages — inline collapse UX working.
- All new code uses ESM `.js` imports, strict TypeScript, no `any`, no `require()`.
- PRD Section 2.8 updated; feature index (`docs/features/README.md`) updated.

### ✅ Phase 3 Terminal Aesthetic (2026-03-01)

- `ChatBubble` terminal-style redesign:
  - Removed thick left borders (subtle 1px accent only for tool/system)
  - Agent messages: no background, text on page background
  - User messages: subtle bg-surface/50 tint + ml-4 indent
  - Smaller role labels (10px, muted/70), tighter padding
- `BashExecutionBubble` inline text styling:
  - No nested boxes (removed bg-surface-2 containers)
  - `$ command` with accent prefix, output in muted monospace
  - Status inline (exit code, cancelled)
- `ToolResultBubble` matching design:
  - Header inline (tool + path), content in muted monospace
  - Diff coloring for edit tool
- `CollapsibleEntry` minimal chrome:
  - Removed always-visible Copy/Less buttons
  - CollapseBar simplified (10px label, ▲ button)
- Spacing reduced (Stack gap 2, tighter padding throughout)
- Typography-driven hierarchy (thinking italic, tool calls monospace/accent)

### ✅ Additional Fixes (2026-03-01)

- **ANSI escape sequences:** Created `frontend/src/utils/text.ts` with `stripAnsi()` utility.
  Applied to `BashExecutionBubble` and `ToolResultBubble` — no raw escape codes in UI.
- **Thinking text:** Updated to render inline (muted italic) for short blocks, collapsible preview for long blocks (>200 chars or >3 lines). Matches pi CLI aesthetic.
- **Removed redundant labels:** 
  - `ChatBubble` no longer shows labels by default
  - `CollapseBar` replaced with minimal `CollapseButton`
  - `CollapsibleEntry` shows content preview without labels
  - Tool calls removed from ContentBlocks (redundant with tool executions)
- **Overflow handling redesigned:**
  - Page never scrolls horizontally
  - Prose uses word-wrap for natural line breaks
  - Code/output in scrollable containers (`overflow-x: auto`, `whitespace-pre`)
  - Commands shown in scrollable header containers
- **Bash/Tool bubbles redesigned:**
  - Clear header with tool name and context info
  - Output in scrollable container (horizontal scroll for long lines)
  - Full content always viewable via scrolling
- **Tool header parsing improved:**
  - `parseToolHeader` rewritten to handle data limitations
  - Shows useful context (line counts, result counts) when path/command not available
  - Extracts paths from success messages (edit, write)

### ✅ Follow-up Items Resolved

**FU-1:** Added `--color-on-accent: #ffffff;` token to `index.css`, replaced `text-white` with `text-on-accent`.

**FU-2:** Filled in Data Flow and Key Functions sections in `docs/features/ux-overhaul.md`.

### ℹ️ Informational (no action required)

- **Class naming:** Ticket specified `.prose-terminal` in `app.css`; implementation uses `.markdown-prose` in `index.css`. `index.css` is the correct project file (`app.css` does not exist), and `.markdown-prose` is an appropriate name. No functional impact.
- **Task 19 (inline tool rendering):** Tool calls render inline within ContentBlocks. Tool results remain separate entries due to entry model structure — would require significant refactoring to change.
- **Task 26 (syntax highlighting):** Deferred to future enhancement.

## Notes

- Do NOT duplicate ADR/PRD content — reference it.
- No icons anywhere — text labels and positional cues only.
- Test primarily on iOS Safari (mobile-first target).
- The markdown renderer should be reusable for the File Inspector's markdown rendering (PRD 3.5) — design it as a standalone component.
- iOS Safari has quirks with `position: sticky` inside scroll containers and momentum scrolling — test scroll behavior carefully.
