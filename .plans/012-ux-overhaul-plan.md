# TICKET-012: UX Overhaul — Message Rendering, Toolbar, Scrolling & Collapsibles

## Objective
Comprehensive UX overhaul of the session detail view: terminal-style markdown rendering, unified message rendering without empty bubbles, subtle chat alignment, floating toolbar, smart auto-scroll, and improved collapsible UX.

## Key Findings

### Existing Code Patterns
- `SessionDetail.tsx` (~900 lines) contains `renderEntry`, `renderMessageEntry`, `CollapsibleEntry`, and all scroll logic
- Scroll logic scattered across `handleNewStreamingMessage`, `handleStreamActivity`, and scroll event listener
- `ChatBubble.tsx` uses `roleStyles` map with left border colors; no alignment support
- `index.css` already has `.markdown-prose` styles defined but NOT applied to any messages
- `StreamingMessage.tsx` renders text via DOM manipulation (`el.appendChild(document.createTextNode(...))`)
- No `hooks/` directory exists — will create for `useAutoScroll`
- `isRenderable` checks `entry.message.role === "custom" && !entry.message.display` but doesn't filter tool-call-only assistant messages

### Risks / Edge Cases
- iOS Safari quirks with `position: sticky` inside scroll containers — need to test toolbar positioning
- Markdown rendering via `marked` is async-safe but may need sanitization (DOMPurify already in deps?)
- Streaming text is appended incrementally — need to either re-parse full text on each delta or batch updates
- `CollapsibleEntry` collapsed preview currently shows emoji role labels (📋, 🔧) — need to remove per "no icons" rule
- Auto-scroll detection via scroll delta may conflict with iOS momentum scrolling

### Dependencies
- `marked` already a dependency (per ADR 001)
- DOMPurify installed for markdown sanitization

## Tasks

- [x] **1. Create `useAutoScroll` hook** — `frontend/src/hooks/useAutoScroll.ts`
  Extract and unify scroll logic: auto-scroll on by default, pause on scroll-up, expose `{ isAutoScrolling, scrollToBottom, handleContentChange, containerProps }`.

- [x] **2. Create `MarkdownRenderer` component** — `frontend/src/components/ui/MarkdownRenderer.tsx`
  Use `marked` to parse markdown, render as HTML with `dangerouslySetInnerHTML`, wrap in `.markdown-prose` class. Add DOMPurify sanitization.

- [x] **3. Add alignment support to `ChatBubble`** — `frontend/src/components/ui/ChatBubble.tsx`
  Add `align?: "left" | "right"` prop. User messages get `ml-6 mr-0`, assistant/tool/system get full width. Remove icon references.

- [x] **4. Filter empty assistant bubbles in rendering** — `frontend/src/components/SessionDetail.tsx`
  Update `isRenderable` to return false for assistant messages with no text blocks (only tool calls). Verify entries render exactly once.

- [x] **5. Apply `MarkdownRenderer` to messages** — `frontend/src/components/SessionDetail.tsx`, `frontend/src/components/StreamingMessage.tsx`
  Replace `whitespace-pre-wrap` text rendering with `MarkdownRenderer` for assistant text content. Update `ContentBlocks` and `StreamingMessageBubble`.

- [x] **6. Create floating `Toolbar` component** — `frontend/src/components/ui/Toolbar.tsx`
  Floating pill (fixed/sticky top-right), semi-transparent background with backdrop blur, compact text labels, collapsible to toggle button.

- [x] **7. Refactor `SessionDetail` header to use `Toolbar`** — `frontend/src/components/SessionDetail.tsx`
  Move Connect/Files/Model/Tree/Expand actions into `Toolbar`. Keep back button and session title in minimal sticky header.

- [x] **8. Integrate `useAutoScroll` hook** — `frontend/src/components/SessionDetail.tsx`
  Replace inline scroll logic with hook. Connect to streaming callbacks and container ref.

- [x] **9. Fix scroll-to-bottom visibility threshold** — `frontend/src/components/SessionDetail.tsx`
  Change from "2 screens away" to "not at bottom". Button visible when `scrollTop + clientHeight < scrollHeight - threshold` (small threshold like 50px).

- [x] **10. Add "New messages" pill for paused auto-scroll** — `frontend/src/components/SessionDetail.tsx`
  When auto-scroll paused and new streaming content arrives, show floating pill above prompt input. Tap re-enables auto-scroll.

- [x] **11. Verify bottom padding for prompt input** — `frontend/src/components/SessionDetail.tsx`
  Confirm `pb-24` is sufficient. Consider measuring `PromptInput` height dynamically if multi-line expands. **Updated to `pb-28` for safety margin.**

- [x] **12. Rework `CollapsibleEntry` UX** — `frontend/src/components/SessionDetail.tsx`
  Add sticky collapse bar at top of expanded content with role label and "Collapse" text. Remove emoji from Copy/Collapse controls.

- [x] **13. Update `index.css` if needed** — `frontend/src/index.css`
  Already has `.markdown-prose` styles. No hardcoded hex values in new component code.

- [x] **14. Export new components from ui index** — `frontend/src/components/ui/index.ts`
  Add exports for `MarkdownRenderer` and `Toolbar`.

- [x] **15. Improve bash execution rendering (Phase 1)** — `frontend/src/components/SessionDetail.tsx`
  Rework `bashExecution` case in `renderMessageEntry`: show command prominently, output preview (4 lines) in muted color, collapsed by default, expand for full output. Match pi CLI aesthetic.

- [x] **16. Create unified ToolResultBubble (Phase 2)** — `frontend/src/components/SessionDetail.tsx`
  Create `ToolResultBubble` component with per-tool rendering based on `toolName`:
  - `read`: Parse path from content, show with line range, 10-line preview
  - `write`: Parse path from content, show with line count, 10-line preview  
  - `edit`: Parse path from content, render as diff with +/- coloring
  - `ls`: Parse path from content, 20-line preview, directory listing style
  - `find`: Parse pattern/path from content, 20-line preview
  - `grep`: Parse pattern/path from content, 15-line preview with match highlighting
  - Fallback: tool name + generic content preview
  Reference: `docs/research/tool-rendering-research.md`

## Phase 3: Terminal-Like Aesthetic Redesign

**Goal:** Make Sol look as good as the pi CLI terminal — not like a chat messaging app.

**Reference:** See PRD 001 Section 3.2.1 "Visual Design Philosophy — Terminal Aesthetic"

### Analysis: What makes pi CLI look good vs. Sol look bad

**pi CLI (good):**
```
Now let me run the build to verify everything compiles:    ← Thinking (muted italic)

Now let's verify the build:                                ← Agent text (primary)

$ cd /Users/.../sol && npm run build 2>&1                  ← $ accent, command bold
> sol@0.1.0 build                                          ← Output muted monospace
> tsc --noEmit && cd frontend && npx tsc --noEmit

Build passes. Let me run the tests:                        ← Agent text resumes
```

- Single background, no nested boxes
- Typography and color create hierarchy
- Tools render inline with conversation
- Minimal chrome, no redundant labels
- Compact, information-dense

**Sol (bad):**
- Heavy chat bubbles with thick colored borders
- Nested bg-surface-2 boxes inside bg-surface containers
- "AGENT" label + "bash" badge + separate "bash" bubble = redundant
- Tool results disconnected from agent message
- Always-visible Copy/Less buttons
- Heavy padding, rounded corners everywhere

### Tasks

- [x] **18. Remove chat bubble chrome from agent messages** — `ChatBubble.tsx`, `SessionDetail.tsx`
  - Remove thick left border (or make it very subtle: 1px, low opacity)
  - Remove "AGENT" / role labels (or make very small and muted)
  - Remove heavy padding — tighter spacing
  - Keep minimal background tint only for user messages (to distinguish them)
  - Agent messages: no background, just text on page background

- [~] **19. Inline tool rendering within agent messages** — `SessionDetail.tsx`
  - Partial: Tool calls render inline within ContentBlocks (compact monospace)
  - Tool results still render as separate entries (due to entry model structure)
  - Full inline rendering would require restructuring entry grouping — deferred

- [x] **20. Simplify bash rendering** — `BashExecutionBubble` or new component
  - Remove ALL nested boxes (no bg-surface-2)
  - Command: `$ ` in accent + command in primary, no background box
  - Output: muted monospace text, same background as container
  - Truncation hint: "... N more lines — tap to expand" in accent
  - Exit code badge only if non-zero, inline and subtle

- [x] **21. Simplify tool result rendering** — `ToolResultBubble`
  - Same inline text approach as bash
  - Tool header (e.g., `read src/app.ts`) in primary text, no box
  - Content in muted monospace, same background
  - No nested containers

- [x] **22. Hide controls until needed** — `SessionDetail.tsx`
  - Removed always-visible "Copy" and "Less" buttons from CollapsibleEntry
  - Only collapse control remains (▲ in CollapseBar)

- [x] **23. Reduce spacing and padding** — `ChatBubble.tsx`, `SessionDetail.tsx`, `index.css`
  - Tighter margins between messages (Stack gap 2 instead of 3)
  - Less internal padding in message containers
  - More information-dense layout
  - Touch targets preserved via min-h-[var(--spacing-touch)]

- [x] **24. User message styling** — `ChatBubble.tsx`
  - Subtle distinction from agent (bg-surface/50 tint + slight indent ml-4)
  - No heavy bubble or border
  - Small muted "You" label

- [x] **25. Typography-driven hierarchy** — `index.css`, component styles
  - Thinking text: muted, italic
  - Agent prose: primary color, regular weight
  - Bash commands: monospace, accent $ prefix
  - Tool output: monospace, muted
  - Tool calls: monospace, accent tool name

- [ ] **26. Add syntax highlighting for code content** — `SessionDetail.tsx`
  For read/write tool results containing code, apply syntax highlighting based on file extension.
  Consider using Shiki (already used for file inspector) or lightweight alternative.
  **Deferred to future enhancement.**

## Verification

**Build & Test:**
```bash
npm run build && npm test
```
✅ Build passes (Phase 1-3)
✅ All 91 tests pass (Phase 1-3)

**Phase 1-2 Manual Checks (DONE):**
- [x] Open session with mixed message types — no empty bubbles
- [x] Markdown renders styled headings, code blocks, lists
- [x] Toolbar collapses/expands; all actions accessible
- [x] Bottom content not obscured by prompt input
- [x] Auto-scroll follows new messages; pauses on scroll-up
- [x] "New messages" pill appears when paused during streaming
- [x] Scroll-to-bottom button visible when not at bottom

**Phase 3 Manual Checks — Terminal Aesthetic (DONE):**
- [x] Compare side-by-side with pi CLI terminal — much closer aesthetic
- [x] No heavy chat bubbles or thick borders visible — subtle 1px accent lines only
- [x] No nested box containers (bg-surface-2 inside bg-surface) — removed
- [~] Tool executions render inline — tool calls inline, results still separate entries
- [x] Bash shows `$ command` with output below, no boxes around either
- [x] Copy/Less controls hidden — removed from CollapsibleEntry
- [x] Compact spacing — Stack gap reduced, tighter padding throughout
- [x] Typography creates hierarchy (bold, muted, monospace) not backgrounds
- [x] User messages have subtle distinction (bg-surface/50 tint)
- [x] Feels more like a terminal, less like a messaging app

## Implementation Summary

### Files Created
- `frontend/src/hooks/useAutoScroll.ts` — Smart auto-scroll hook with pause detection
- `frontend/src/components/ui/MarkdownRenderer.tsx` — DOMPurify-sanitized markdown renderer
- `frontend/src/components/ui/Toolbar.tsx` — Floating collapsible toolbar
- `frontend/src/utils/text.ts` — Text utilities (ANSI stripping, line truncation)

### Files Modified
- `frontend/src/components/ui/ChatBubble.tsx` — Minimal labels redesign:
  - NO labels by default — conversation flow is self-evident
  - Labels only shown when explicitly provided
  - User messages: subtle bg-surface/50 tint + ml-4 indent
  - Agent messages: no background, text flows naturally
  - System messages: subtle left border
- `frontend/src/components/ui/index.ts` — Added exports for new components
- `frontend/src/index.css` — Added `--color-on-accent` semantic token, proper overflow handling
- `frontend/src/components/SessionDetail.tsx` — Major refactor:
  - Integrated `useAutoScroll` hook
  - Added floating `Toolbar` with Connect/Files/Tree/Expand actions
  - `CollapseButton` — minimal collapse control (no label, just button)
  - `CollapsibleEntry` — no labels, compact preview with expand hint
  - Added "New messages" pill when auto-scroll paused
  - Filtered empty assistant messages in `isRenderable`
  - Applied markdown to assistant content
  - `ContentBlocks` — removed tool call rendering (redundant with tool executions)
  - `BashExecutionBubble` redesigned:
    - Command header: `$ {command}` in scrollable container
    - Output: scrollable container with `whitespace-pre` (horizontal scroll)
    - ANSI escape sequences stripped
    - Status inline with command
  - `ToolResultBubble` redesigned:
    - Header: tool name + path in scrollable container
    - Content: scrollable container with `whitespace-pre`
    - Diff coloring for edit tool
    - ANSI escape sequences stripped
  - Thinking blocks — inline muted italic (short), collapsible preview (long)
  - Stack gap reduced to 2 (tighter spacing)
- `frontend/src/components/StreamingMessage.tsx` — Added markdown on complete, removed emoji

### Dependencies Added
- `dompurify` + `@types/dompurify` — For safe HTML sanitization in markdown rendering
