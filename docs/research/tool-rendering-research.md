# Research: pi-coding-agent Tool Rendering

**Date:** 2026-03-01
**Purpose:** Understand how pi-coding-agent renders tool calls and results to inform Sol's implementation

## Summary

pi-coding-agent has a sophisticated, **per-tool rendering system** that treats each tool type (bash, read, write, edit, ls, find, grep) differently. The rendering is NOT just for "bash" — it's a unified system for ALL tools with custom formatting per tool type.

## Key Findings

### 1. Architecture

The rendering system has two layers:

1. **Built-in tools** (`bash`, `read`, `write`, `edit`, `ls`, `find`, `grep`) — hardcoded rendering in `ToolExecutionComponent.formatToolExecution()`
2. **Custom tools** — can provide `renderCall(args, theme)` and `renderResult(result, options, theme)` methods

Files examined:
- `dist/modes/interactive/components/tool-execution.js` — main tool rendering
- `dist/modes/interactive/components/bash-execution.js` — specialized bash streaming component
- `examples/extensions/built-in-tool-renderer.ts` — shows how to override built-in tool rendering

### 2. Rendering Pattern Per Tool

| Tool | Header | Preview Lines | Key Info Shown |
|------|--------|---------------|----------------|
| `bash` | `$ {command}` | 5 lines | Exit code, timeout, truncation path |
| `read` | `read {path}:line-range` | 10 lines | Syntax highlighting, truncation stats |
| `write` | `write {path}` | 10 lines | Syntax highlighting, line count |
| `edit` | `edit {path}:line` | Full diff | Diff with +/- coloring, first changed line |
| `ls` | `ls {path}` | 20 lines | Entry limit warning |
| `find` | `find {pattern} in {path}` | 20 lines | Result limit warning |
| `grep` | `grep /{pattern}/ in {path}` | 15 lines | Match limit, line truncation warning |

### 3. Common Rendering Patterns

All tools follow these patterns:

```
┌─────────────────────────────────────────┐
│ {tool} {path/command}                   │  ← Header: tool name (bold) + main arg (accent color)
│                                         │
│ {output line 1}                         │  ← Output in muted/tool-output color
│ {output line 2}                         │
│ ...                                     │
│ ... (N more lines, ctrl+e to expand)    │  ← Truncation hint with keybinding
│                                         │
│ [Truncated: showing X of Y lines]       │  ← Warning for LLM context truncation
│ [Full output: /tmp/path]                │  ← Path to full output if available
└─────────────────────────────────────────┘
```

### 4. Expand/Collapse Behavior

- **Collapsed (default)**: Shows first N lines + "... (X more lines, expand)" hint
- **Expanded**: Shows all available lines (may still be truncated for LLM context)
- **Toggle**: User presses `ctrl+e` or clicks to expand/collapse
- **State**: `expanded` boolean passed to `renderResult(result, { expanded, isPartial }, theme)`

### 5. Color/Theme Usage

From the theme system:
- `toolTitle` — tool name (bold)
- `accent` — file paths, patterns, important values
- `toolOutput` — output text (muted)
- `muted` — hints, less important text
- `warning` — truncation warnings
- `error` — errors, exit codes
- `dim` — subtle info
- `toolDiffAdded` / `toolDiffRemoved` — diff coloring

Background colors:
- `toolPendingBg` — while tool is running
- `toolSuccessBg` — tool completed successfully
- `toolErrorBg` — tool failed

### 6. Special Handling

#### Bash Execution
- Has its own component (`BashExecutionComponent`) for streaming output during execution
- Shows spinner while running with "Running... (cancel)" hint
- Separate from `ToolExecutionComponent` which renders bash results in history

#### Edit Tool
- Computes diff preview BEFORE tool executes (async)
- Shows unified diff with +/- line coloring
- Shows first changed line number in header

#### Read/Write Tools
- Apply syntax highlighting based on file extension
- Use incremental highlighting cache for write (during streaming)

#### Images
- Tool results can include images
- Rendered inline if terminal supports it (Kitty/iTerm2)
- Shows fallback text if images disabled or unsupported

### 7. Truncation System

pi has TWO levels of truncation:

1. **LLM Context Truncation** — Limits output sent to the model (2000 lines / 50KB)
   - Saves full output to temp file
   - Shows path to full output in UI

2. **Visual Truncation** — Limits lines shown in UI preview
   - Collapsed: 5-20 lines depending on tool
   - Expanded: All lines from LLM context

## Implications for Sol

### Current Sol State

Sol has these message types for tools:
- `bashExecution` — command, output, exitCode, cancelled, truncated
- `toolResult` — toolCallId, toolName, content, isError

Sol currently renders them differently but should apply the **same patterns** to both.

### Recommended Changes

1. **Create a unified tool rendering system** that handles ALL tool types consistently
2. **Show tool name + main argument** prominently for all tools (not just bash)
3. **Apply per-tool formatting** for the 7 built-in tools (bash, read, write, edit, ls, find, grep)
4. **Generic fallback** for custom/unknown tools
5. **Use consistent preview truncation** with "N more lines — tap to expand"
6. **Show truncation warnings** when output was truncated for LLM context
7. **Apply syntax highlighting** for read/write content where possible

### Tool Type Detection

From `toolResult.toolName`, apply specific rendering:
- `bash` → command-style header, exit code badge
- `read` → path header with line range, syntax highlighted content
- `write` → path header, syntax highlighted content
- `edit` → path header with line number, unified diff display
- `ls` → path header, directory listing
- `find` → pattern + path header, file list
- `grep` → pattern + path header, match results
- Other → generic tool name + JSON args fallback

### Data Available in Sol

From the session entries (defined in `SessionDetail.tsx`):

**`bashExecution` message:**
```typescript
{
  role: "bashExecution";
  command: string;       // The command that was run
  output: string;        // Raw output text
  exitCode: number | undefined;
  cancelled: boolean;
  truncated: boolean;
  timestamp: number;
}
```

**`toolResult` message:**
```typescript
{
  role: "toolResult";
  toolCallId: string;
  toolName: string;      // "read", "write", "edit", "ls", etc.
  content: ContentBlock[];  // Array of {type: "text", text: string} or {type: "image", ...}
  isError: boolean;
  timestamp: number;
}
```

**Key limitation:** For `toolResult`, the original tool ARGUMENTS (path, command, etc.) are NOT stored — only the result content. This means Sol cannot show "read /path/to/file" for toolResult entries unless it parses the content text (which often contains the path in the output).

**ContentBlock types:**
- `text` — `{ type: "text", text: string }`
- `image` — `{ type: "image", data: string, mimeType: string }`
- `thinking` — `{ type: "thinking", text: string, redacted?: boolean }`
- `toolCall` — `{ type: "tool_use", name: string, input: object }`

### Priority

1. **High**: Fix bash rendering (current focus)
2. **Medium**: Improve toolResult rendering for read/write/edit with content parsing
3. **Low**: Add syntax highlighting for code in read/write results

## References

- `@mariozechner/pi-coding-agent/dist/modes/interactive/components/tool-execution.js`
- `@mariozechner/pi-coding-agent/dist/modes/interactive/components/bash-execution.js`
- `@mariozechner/pi-coding-agent/examples/extensions/built-in-tool-renderer.ts`
- `@mariozechner/pi-coding-agent/docs/tui.md`
