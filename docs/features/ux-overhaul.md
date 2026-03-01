# UX Overhaul: Terminal-Like Aesthetic

## Overview

A comprehensive UX overhaul to make Sol **look and feel like the pi CLI terminal**, not like a chat messaging app.

**Core Goal:** The pi CLI looks good because it uses typography and color to create visual hierarchy — not nested boxes, bubbles, badges, or heavy borders. Sol must adopt this same design philosophy.

**Key Changes:**
1. **Remove chat bubble aesthetic** — no heavy borders, nested containers, or always-visible buttons
2. **Inline tool rendering** — tools flow naturally within conversation, not as separate disconnected bubbles
3. **Typography-driven hierarchy** — bold, italic, color, monospace instead of backgrounds/borders
4. **Minimal chrome** — no redundant labels, compact spacing, controls hidden until needed
5. **Terminal feel** — dark theme, monospace for code, information-dense layout

This feature focuses purely on frontend presentation and interaction — no backend changes required.

## Visual Reference: pi CLI vs Sol

**pi CLI (target):**
```
Now let me run the build to verify everything compiles:    ← Thinking (muted italic)

Now let's verify the build:                                ← Agent text (primary)

$ cd /Users/.../sol && npm run build 2>&1                  ← $ accent, command bold
> sol@0.1.0 build                                          ← Output muted monospace
> tsc --noEmit && cd frontend && npx tsc --noEmit

Build passes. Let me run the tests:                        ← Agent text resumes
```

**What makes pi CLI look good:**
- Single unified background — no nested boxes
- Typography creates hierarchy — bold, muted, monospace
- Tools render inline — part of conversation flow
- Minimal chrome — no labels, badges, or visible buttons
- Compact — information-dense, not padding-heavy

**Sol current state (problems):**
- Heavy chat bubbles with thick colored left borders
- Nested containers (bg-surface-2 inside bg-surface)
- "AGENT" label + "bash" badge + separate "bash" bubble below
- Tool results disconnected from agent message
- Always-visible "Copy" and "Less" buttons
- Heavy padding and rounded corners everywhere

**Sol target state:**
- Look like the pi CLI terminal
- Feel like reading a terminal session, not a chat thread
- Tools integrated into conversation flow
- Typography and color for hierarchy, not boxes
- Controls appear on interaction, not always visible

## User Stories

From [PRD 001](../PRD/001-sol.md) Section 2.2:
- "As a developer, I want user messages, assistant responses, and tool results visually distinguished so the conversation is easy to follow."
- "As a developer, I want to expand and collapse tool calls so I can focus on the conversational flow without clutter."

From [PRD 001](../PRD/001-sol.md) Section 2.8:
- "As a developer, I want the UI to feel like a polished native app with snappy navigation so working from my phone doesn't feel like a compromise."

Additional stories for this feature:
- "As a developer, I want agent messages to render markdown with terminal-style formatting so they look consistent with how pi renders in the CLI."
- "As a developer, I want to never have a message hidden behind the input box so I can always read the full conversation."
- "As a developer, I want auto-scroll to follow new messages but stop when I manually scroll up, with a clear way to re-enable it."
- "As a developer, I want to collapse an expanded message inline without scrolling to find a button."

## Implementation

> **Note:** This section is completed by the implementation agent.

### Key Files

| File | Purpose |
|------|---------|
| `frontend/src/components/SessionDetail.tsx` | Main session view — toolbar, scroll logic, entry rendering |
| `frontend/src/components/StreamingMessage.tsx` | Streaming message rendering |
| `frontend/src/components/ui/ChatBubble.tsx` | Message container styling — alignment, deduplication |
| `frontend/src/components/ui/Toolbar.tsx` | NEW: Floating collapsible toolbar component |
| `frontend/src/components/ui/MarkdownRenderer.tsx` | NEW: Terminal-style markdown renderer |
| `frontend/src/hooks/useAutoScroll.ts` | NEW: Smart auto-scroll hook |
| `frontend/src/utils/text.ts` | NEW: Text utilities — ANSI stripping, line truncation |
| `frontend/src/index.css` | Tailwind theme + markdown prose styles |

### Data Flow

**Historical Session Entries:**
1. `SessionDetail` fetches entries via `/api/session/:id` → `SessionDetailData`
2. Entries pass through `isRenderable()` filter (skips hidden entries, empty assistant messages)
3. For each renderable entry, `renderEntry()` delegates to `renderMessageEntry()` based on type
4. Message-specific components render: `ChatBubble`, `BashExecutionBubble`, `ToolResultBubble`
5. Long/complex entries wrap in `CollapsibleEntry` with `CollapseBar` for inline collapse UX

**Streaming (Active Sessions):**
1. SSE events from `/api/session/:id/stream` → `StreamingMessageContainer`
2. `onStreamActivity` callback triggers `useAutoScroll.handleContentChange()` when auto-scroll enabled
3. If auto-scroll paused, `setHasNewMessages(true)` shows "New messages" pill
4. `onSessionEntry` callback appends finalized entries to `data.entries` via `handleSessionEntry()`
5. `useAutoScroll` hook manages scroll position: pause on scroll-up, resume on tap

### Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `isRenderable()` | SessionDetail.tsx | Filters entries — skips non-display custom, empty assistant |
| `assistantHasTextContent()` | SessionDetail.tsx | Checks if assistant message has text (not just tool calls) |
| `shouldCollapseByDefault()` | SessionDetail.tsx | Collapse logic: tool results always, long text messages |
| `renderEntry()` | SessionDetail.tsx | Top-level entry renderer, delegates by entry type |
| `renderMessageEntry()` | SessionDetail.tsx | Per-role message rendering (user, assistant, bash, tool) |
| `useAutoScroll()` | hooks/useAutoScroll.ts | Smart scroll: auto-follow, pause on scroll-up, resume |
| `MarkdownRenderer` | ui/MarkdownRenderer.tsx | marked + DOMPurify → sanitized HTML in `.markdown-prose` |
| `Toolbar` | ui/Toolbar.tsx | Floating collapsible pill with session actions |
| `CollapseBar` | SessionDetail.tsx | Sticky header in expanded entries with collapse control |
| `CollapsibleEntry` | SessionDetail.tsx | Wrapper with expand/collapse state and preview |
| `BashExecutionBubble` | SessionDetail.tsx | Bash command + output preview, ANSI stripped |
| `ToolResultBubble` | SessionDetail.tsx | Per-tool result rendering, ANSI stripped |
| `stripAnsi()` | utils/text.ts | Remove ANSI escape sequences from terminal output |

## Rationale

### Design Decisions

#### 1. Terminal-Style Markdown Rendering

Agent messages currently render as raw markdown text. The pi CLI renders markdown with styled headings, bold, code blocks, lists, and links in the terminal. Sol should mirror this aesthetic using a dark-theme prose renderer — not a generic "GitHub-style" markdown look, but one that feels native to a terminal/developer tool. Uses `marked` (already a dependency) with custom CSS scoped to a `.prose-terminal` class.

#### 2. Unified Message Rendering — No Empty Bubbles

The current implementation renders a `ChatBubble` for every assistant message entry, including those with only tool calls and no text content. These appear as empty boxes. The fix: skip rendering entries that have no user-visible content (tool-call-only assistant messages where the text content is empty). Each message renders exactly once.

For visual differentiation between user and agent: subtle left/right alignment rather than heavy chat bubbles. User messages align slightly right with a distinct but understated background. Agent messages left-aligned, full width. No icons — role is implied by position and a minimal label. This avoids wasting horizontal space (critical on mobile) while maintaining conversational feel.

#### 3. Floating Collapsible Toolbar

The current header packs Connect, Files, Model, Tree, Expand/Collapse into a cramped horizontal row. Replace with a floating toolbar (pill-shaped, semi-transparent) positioned at the top-right. Shows key actions as compact text labels. Can be collapsed to a single toggle button to maximize reading space. Uses `position: sticky` or `fixed` with appropriate z-index layering.

#### 4. Smart Auto-Scroll

Current scroll behavior has multiple issues: messages hidden behind the fixed prompt input, no reliable auto-scroll for new content, and scroll-to-bottom only appearing after scrolling far up.

New behavior:
- **Auto-scroll active by default** when entering a session or when at/near the bottom.
- **Auto-scroll pauses** when the user scrolls up (detected via scroll direction).
- **Floating "↓ New messages" pill** appears when auto-scroll is paused and new content arrives.
- **Tapping the pill** re-enables auto-scroll and scrolls to bottom.
- **Scroll-to-bottom button** always visible when not at the bottom of the conversation (not gated by "2 screens away").
- **Bottom padding** accounts for the fixed prompt input height so no content is ever obscured.

#### 5. Inline Expand/Collapse

Current: tap to expand, then scroll to find a small "▲ Less" button at the bottom of expanded content. New: a sticky collapse affordance (bar/button) at the top of the expanded content that remains visible while scrolling through the expanded message. Alternatively, a double-tap or tap-on-header gesture to collapse. The expanded view should show a clear, always-visible collapse control at the top of the message — not just the bottom.

#### 6. Tool Rendering System (Updated: 2026-03-01)

Based on research into pi-coding-agent's rendering system (see `docs/research/tool-rendering-research.md`), Sol needs a **unified per-tool rendering system** — not just improved bash rendering.

**Problem:** Current tool/bash messages dump raw output that is difficult to parse. The pi CLI presents ALL tool results with clear visual hierarchy using per-tool custom formatting.

**Key Insight: Inline Text Styling, Not Boxes**

The pi CLI achieves visual hierarchy through **typography and color**, NOT nested containers:

```
$ cd /Users/.../sol && npm run build 2>&1   ← $ in accent, command in primary
> sol@0.1.0 build                           ← Output in muted, same background
> tsc --noEmit && cd frontend               ← Output continues inline
... (5 more lines — tap to expand)          ← Truncation hint in accent
```

**Design principles:**
- **No nested boxes** — command and output are styled text within one container
- **Color hierarchy** — accents and muted colors distinguish command from output
- **Minimal chrome** — thin left border only, no redundant labels
- **Inline flow** — feels like conversation, not separate widgets

**Solution:** Implement a tool rendering system with:

1. **Common pattern for all tools:**
   - Header line: tool/command in primary text (no separate box)
   - Output: muted color text, same container background
   - Truncation hint: "N more lines — tap to expand" in accent
   - Status badges: inline at bottom, only when needed

2. **Per-tool formatting for built-in tools:**
   | Tool | Header Style | Preview Lines |
   |------|--------------|---------------|
   | `bash` | `$ {command}` | 5 lines |
   | `read` | `read {path}:range` | 10 lines |
   | `write` | `write {path}` | 10 lines |
   | `edit` | `edit {path}:line` | Full diff |
   | `ls` | `ls {path}` | 20 lines |
   | `find` | `find {pattern} in {path}` | 20 lines |
   | `grep` | `grep /{pattern}/ in {path}` | 15 lines |

3. **Generic fallback:** Unknown tools show tool name + content preview

**Data Limitation:** `toolResult` entries don't include original arguments — only results. For read/write/edit, the path is often in the content (e.g., "Read file: /path/to/file") and can be parsed. For others, fall back to tool name only.

**Implementation Phases:**
- Phase 1 (Done): Basic `BashExecutionBubble` structure
- Phase 2 (Current): Fix visual design — inline text, no nested boxes
- Phase 3: `ToolResultBubble` — per-tool rendering for toolResult entries
- Phase 4: Syntax highlighting for code content (read/write)

### ADR References

- [ADR 006: Tailwind v4 Design Tokens](../ADR/006-tailwind-v4-design-tokens.md) — All new styles must use semantic tokens, not hardcoded values.
- [ADR 001: Tech Stack](../ADR/001-tech-stack.md) — Preact + Vite rendering, `marked` for markdown.

## Current Limitations

1. Terminal-style markdown rendering won't perfectly replicate the pi CLI (which uses terminal ANSI codes) — it's a CSS approximation of the aesthetic.
2. Smart auto-scroll requires careful scroll event handling; may need tuning for iOS Safari momentum scrolling.
3. The floating toolbar may need iteration for discoverability — users accustomed to the header layout may not immediately find collapsed actions.
