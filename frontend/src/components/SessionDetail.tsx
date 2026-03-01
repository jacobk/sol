import type { JSX } from "preact";
import { useState, useEffect, useCallback, useMemo } from "preact/hooks";
import {
  Badge,
  Body,
  ChatBubble,
  CodeText,
  Container,
  IconButton,
  MarkdownRenderer,
  Metadata,
  Stack,
  Title,
  Toolbar,
} from "./ui/index.js";
import {
  extractAllContent,
  extractPlainText,
  type ContentBlock,
  type ExtractedContent,
} from "../utils/content.js";
import {
  BranchSelector,
  TreeOverview,
  type BranchOption,
  type TreeBranch,
} from "./BranchSelector.js";
import { PromptInput } from "./PromptInput.js";
import { StreamingMessageContainer } from "./StreamingMessage.js";
import { ModelSwitcher } from "./ModelSwitcher.js";
import { stripAnsi } from "../utils/text.js";
import { useAutoScroll } from "../hooks/useAutoScroll.js";

/** Session entry types mirroring the backend API response */

interface SessionMessageEntry {
  type: "message";
  id: string;
  parentId: string | null;
  timestamp: string;
  message: MessagePayload;
}

interface CompactionEntry {
  type: "compaction";
  id: string;
  parentId: string | null;
  timestamp: string;
  summary: string;
  tokensBefore: number;
}

interface BranchSummaryEntry {
  type: "branch_summary";
  id: string;
  parentId: string | null;
  timestamp: string;
  summary: string;
}

interface CustomMessageEntry {
  type: "custom_message";
  id: string;
  parentId: string | null;
  timestamp: string;
  customType: string;
  content: string | ContentBlock[];
  display: boolean;
}

interface OtherEntry {
  type: "thinking_level_change" | "model_change" | "custom" | "label" | "session_info";
  id: string;
  parentId: string | null;
  timestamp: string;
}

type SessionEntry =
  | SessionMessageEntry
  | CompactionEntry
  | BranchSummaryEntry
  | CustomMessageEntry
  | OtherEntry;

type MessagePayload =
  | UserMessage
  | AssistantMessage
  | ToolResultMessage
  | BashExecutionMessage
  | CompactionSummaryMessage
  | BranchSummaryMessage
  | CustomAgentMessage;

interface UserMessage {
  role: "user";
  content: string | ContentBlock[];
  timestamp: number;
}

interface UsageInfo {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}

interface AssistantMessage {
  role: "assistant";
  content: ContentBlock[];
  model: string;
  provider: string;
  usage: UsageInfo;
  stopReason: string;
  timestamp: number;
}

interface ToolResultMessage {
  role: "toolResult";
  toolCallId: string;
  toolName: string;
  content: ContentBlock[];
  isError: boolean;
  timestamp: number;
}

interface BashExecutionMessage {
  role: "bashExecution";
  command: string;
  output: string;
  exitCode: number | undefined;
  cancelled: boolean;
  truncated: boolean;
  timestamp: number;
}

interface CompactionSummaryMessage {
  role: "compactionSummary";
  summary: string;
  tokensBefore: number;
  timestamp: number;
}

interface BranchSummaryMessage {
  role: "branchSummary";
  summary: string;
  fromId: string;
  timestamp: number;
}

interface CustomAgentMessage {
  role: "custom";
  customType: string;
  content: string | ContentBlock[];
  display: boolean;
  timestamp: number;
}

interface SessionHeader {
  type: "session";
  version?: number;
  id: string;
  timestamp: string;
  cwd: string;
}

interface SessionDetailData {
  header: SessionHeader | null;
  entries: SessionEntry[];
}

/** Tree node from the /api/tree/:id endpoint */
interface TreeNode {
  id: string;
  parentId: string | null;
  type: string;
  role: string | null;
  timestamp: string;
  preview: string;
  childCount: number;
  children: TreeNode[];
}

interface TreeData {
  header: SessionHeader | null;
  tree: TreeNode[];
}

type LoadState = "idle" | "loading" | "error";

interface SessionDetailProps {
  sessionId: string;
  onBack: () => void;
  searchQuery?: string;
  onOpenFiles?: () => void;
}

/** Max characters before a message is considered "long" and collapsed by default */
const COLLAPSE_THRESHOLD = 300;

function formatCost(cost: number): string {
  if (cost === 0) return "$0";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(count: number): string {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return String(count);
}

/**
 * Check if an assistant message has visible text content (not just tool calls).
 */
function assistantHasTextContent(content: ContentBlock[]): boolean {
  return content.some(
    (b: ContentBlock) => b.type === "text" && b.text.trim().length > 0
  );
}

/**
 * Determine whether a message entry should be collapsed by default.
 * User and short assistant text messages stay expanded.
 * Tool results, bash executions, and long messages are collapsed.
 */
function shouldCollapseByDefault(entry: SessionEntry): boolean {
  if (entry.type !== "message") {
    // compaction, branch_summary, custom_message — always collapse
    return true;
  }

  const msg = entry.message;

  switch (msg.role) {
    case "user":
      // User messages: collapse only if very long
      return getMessageTextLength(entry) > COLLAPSE_THRESHOLD;
    case "assistant": {
      // Assistant messages: collapse if long or contains only tool calls
      if (!assistantHasTextContent(msg.content)) return true;
      return getMessageTextLength(entry) > COLLAPSE_THRESHOLD;
    }
    case "toolResult":
    case "bashExecution":
      // Tool results and bash: always collapsed per PRD 3.2
      return true;
    case "compactionSummary":
    case "branchSummary":
    case "custom":
      return true;
    default:
      return true;
  }
}

/** Get approximate text length for collapse decisions */
function getMessageTextLength(entry: SessionEntry): number {
  if (entry.type !== "message") return 0;
  const msg = entry.message;

  switch (msg.role) {
    case "user":
      return extractPlainText(msg.content as string | ContentBlock[]).length;
    case "assistant":
      return extractPlainText(msg.content).length;
    case "toolResult":
      return extractPlainText(msg.content).length;
    case "bashExecution":
      return msg.command.length + msg.output.length;
    case "compactionSummary":
      return msg.summary.length;
    case "branchSummary":
      return msg.summary.length;
    case "custom":
      return extractPlainText(msg.content as string | ContentBlock[]).length;
    default:
      return 0;
  }
}

/** Get copyable plain text for an entry */
function getCopyText(entry: SessionEntry): string {
  if (entry.type === "compaction") return entry.summary;
  if (entry.type === "branch_summary") return entry.summary;
  if (entry.type === "custom_message") {
    return extractPlainText(entry.content as string | ContentBlock[]);
  }
  if (entry.type !== "message") return "";

  const msg = entry.message;
  switch (msg.role) {
    case "user":
      return extractPlainText(msg.content as string | ContentBlock[]);
    case "assistant":
      return extractPlainText(msg.content);
    case "toolResult":
      return extractPlainText(msg.content);
    case "bashExecution":
      return `$ ${msg.command}\n${msg.output}`;
    case "compactionSummary":
      return msg.summary;
    case "branchSummary":
      return msg.summary;
    case "custom":
      return extractPlainText(msg.content as string | ContentBlock[]);
    default:
      return "";
  }
}

/** Get a short preview for collapsed state */
function getPreviewText(entry: SessionEntry): string {
  const full = getCopyText(entry);
  if (full.length <= 120) return full;
  return full.slice(0, 120).trimEnd() + "…";
}

/** Get role label for an entry (no emoji) */
function getRoleLabel(entry: SessionEntry): string {
  if (entry.type === "message") {
    const role = entry.message.role;
    if (role === "toolResult") return entry.message.toolName;
    if (role === "bashExecution") return `Bash: ${entry.message.command.slice(0, 40)}`;
    if (role === "assistant") return "Agent";
    if (role === "user") return "You";
    if (role === "compactionSummary") return "Compaction";
    if (role === "branchSummary") return "Branch";
    if (role === "custom") return entry.message.customType;
  } else if (entry.type === "compaction") return "Compaction";
  else if (entry.type === "branch_summary") return "Branch";
  else if (entry.type === "custom_message") return entry.customType;
  return "";
}

/** Copy button that shows brief feedback (no emoji) */
function CopyButton({ text }: { text: string }): JSX.Element {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      class="text-xs text-text-muted active:text-text-primary min-w-[var(--spacing-touch)] min-h-[var(--spacing-touch)] flex items-center justify-center select-none"
      aria-label="Copy message"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/** Highlights all occurrences of `query` in `text` (case-insensitive) */
function HighlightText({ text, query }: { text: string; query?: string }): JSX.Element {
  if (!query || !query.trim()) {
    return <>{text}</>;
  }
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const parts: JSX.Element[] = [];
  let lastIndex = 0;
  let idx = lowerText.indexOf(lowerQuery);
  let key = 0;

  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push(<span key={key++}>{text.slice(lastIndex, idx)}</span>);
    }
    parts.push(
      <mark key={key++} class="bg-accent/30 text-text-primary rounded-sm px-0.5">
        {text.slice(idx, idx + query.length)}
      </mark>
    );
    lastIndex = idx + query.length;
    idx = lowerText.indexOf(lowerQuery, lastIndex);
  }

  if (lastIndex < text.length) {
    parts.push(<span key={key++}>{text.slice(lastIndex)}</span>);
  }

  return <>{parts}</>;
}

/** Renders content blocks from extractAllContent — with markdown for text */
function ContentBlocks({ blocks, searchQuery, useMarkdown = false }: { blocks: ExtractedContent[]; searchQuery?: string; useMarkdown?: boolean }): JSX.Element {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "text":
            // Use markdown renderer for assistant messages, plain text for others
            if (useMarkdown && !searchQuery) {
              return <MarkdownRenderer key={i} content={block.text} />;
            }
            return (
              <div key={i} class="whitespace-pre-wrap break-words">
                <HighlightText text={block.text} query={searchQuery} />
              </div>
            );
          case "thinking": {
            // Thinking text — inline muted italic like pi CLI
            // Short thinking shown inline, long thinking collapsible
            const thinkingText = block.text.trim();
            const isLong = thinkingText.length > 200 || thinkingText.split("\n").length > 3;
            
            if (block.redacted) {
              return (
                <div key={i} class="text-sm text-text-muted/60 italic">
                  (thinking redacted)
                </div>
              );
            }
            
            if (isLong) {
              // Long thinking — collapsible
              return (
                <details key={i} class="mt-1">
                  <summary class="text-sm text-text-muted/60 italic cursor-pointer select-none">
                    {thinkingText.slice(0, 100)}…
                  </summary>
                  <div class="mt-1 text-sm text-text-muted/60 italic whitespace-pre-wrap break-words">
                    <HighlightText text={thinkingText} query={searchQuery} />
                  </div>
                </details>
              );
            }
            
            // Short thinking — inline
            return (
              <div key={i} class="text-sm text-text-muted/60 italic whitespace-pre-wrap break-words">
                <HighlightText text={thinkingText} query={searchQuery} />
              </div>
            );
          }
          case "toolCall":
            // Don't render tool calls inline — the tool execution follows as a separate entry
            // This avoids redundancy (showing both "bash cd /path..." and then "$ cd /path...")
            return null;
          case "image":
            return (
              <div key={i} class="mt-1 text-text-muted text-sm italic">
                {block.text}
              </div>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

function AssistantMeta({ message }: { message: AssistantMessage }): JSX.Element {
  return (
    <div class="flex flex-wrap items-center gap-2 mt-2">
      <Badge variant="accent">{message.model}</Badge>
      <Metadata>
        {formatTokens(message.usage.totalTokens)} tokens
      </Metadata>
      {message.usage.cost.total > 0 && (
        <Metadata>{formatCost(message.usage.cost.total)}</Metadata>
      )}
    </div>
  );
}

/** Number of output lines to show in preview */
const BASH_PREVIEW_LINES = 5;

/**
 * Bash execution — terminal-style rendering.
 * 
 * Design: Clear command display with scrollable output
 * - Command prominently shown with $ prefix
 * - Output in scrollable container (horizontal scroll for long lines)
 * - ANSI escape sequences stripped
 */
function BashExecutionBubble({ message }: { message: BashExecutionMessage }): JSX.Element {
  const [expanded, setExpanded] = useState(false);

  // Strip ANSI codes and split output into lines
  const cleanOutput = message.output ? stripAnsi(message.output) : "";
  const outputLines = cleanOutput ? cleanOutput.split("\n") : [];
  const hasMoreOutput = outputLines.length > BASH_PREVIEW_LINES;
  const previewLines = outputLines.slice(0, BASH_PREVIEW_LINES);
  const hiddenLines = outputLines.length - BASH_PREVIEW_LINES;

  // Status flags
  const hasError = message.exitCode !== undefined && message.exitCode !== 0;
  const wasCancelled = message.cancelled;

  return (
    <div class="my-2">
      {/* Command — prominent, scrollable for long commands */}
      <div class="font-mono text-sm bg-surface rounded-t px-3 py-2 overflow-x-auto">
        <span class="text-accent-text font-bold select-none">$ </span>
        <span class="text-text-primary whitespace-pre">{message.command}</span>
        {hasError && (
          <span class="text-state-error ml-2">(exit {message.exitCode})</span>
        )}
        {wasCancelled && (
          <span class="text-state-warning ml-2">(cancelled)</span>
        )}
      </div>

      {/* Output — scrollable container */}
      {cleanOutput && (
        <div class="bg-surface-2 rounded-b border-t border-border-subtle">
          {expanded ? (
            // Full output — scrollable both directions
            <div class="font-mono text-xs text-text-muted p-3 max-h-96 overflow-auto">
              <pre class="whitespace-pre">{cleanOutput}</pre>
            </div>
          ) : (
            // Preview output — tappable to expand
            <button
              type="button"
              onClick={() => setExpanded(true)}
              class="w-full text-left font-mono text-xs text-text-muted p-3 active:bg-border-subtle/50 transition-colors"
            >
              <pre class="whitespace-pre overflow-x-auto">{previewLines.join("\n")}</pre>
              {hasMoreOutput && (
                <div class="text-accent-text mt-1">
                  … {hiddenLines} more lines — tap to expand
                </div>
              )}
            </button>
          )}
          {expanded && hasMoreOutput && (
            <div class="px-3 pb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                class="text-xs text-text-muted active:text-text-primary"
              >
                ▲ collapse
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Preview line counts per tool type */
const TOOL_PREVIEW_LINES: Record<string, number> = {
  read: 10,
  write: 10,
  edit: 50, // Diffs can be longer
  ls: 20,
  find: 20,
  grep: 15,
  webfetch: 10,
  default: 10,
};

/** Tool-specific header parsing from content */
interface ToolHeader {
  title: string;
  subtitle?: string;
}

/**
 * Parse tool result content to extract useful header info.
 * 
 * NOTE: toolResult entries don't include original arguments (path, command, etc).
 * We try to parse them from the content text where possible.
 */
function parseToolHeader(toolName: string, content: string): ToolHeader {
  const lines = content.split("\n");
  const firstLine = (lines[0] || "").trim();

  switch (toolName) {
    case "bash": {
      // For bash, the first line of output might give context
      // But we don't have the command - just show "bash" with preview of output
      if (firstLine) {
        const preview = firstLine.length > 50 ? firstLine.slice(0, 50) + "…" : firstLine;
        return { title: "bash", subtitle: preview };
      }
      return { title: "bash" };
    }

    case "read": {
      // Content IS the file contents - we don't have the path
      // Just show "read" with line count
      const lineCount = lines.length;
      return { title: "read", subtitle: `${lineCount} lines` };
    }

    case "write": {
      // Content format: "Successfully wrote X bytes to {path}"
      const writeMatch = content.match(/(?:wrote|written)\s+\d+\s+bytes\s+to\s+([^\s]+)/i);
      if (writeMatch) {
        return { title: writeMatch[1] };
      }
      // Fallback: "Wrote to {path}" or just path
      const pathMatch = content.match(/(?:to|wrote)\s+([\/\w\-_.]+\.\w+)/i);
      if (pathMatch) {
        return { title: pathMatch[1] };
      }
      return { title: "write" };
    }

    case "edit": {
      // Content format: "Successfully replaced text in {path}."
      const editMatch = content.match(/(?:replaced|edited)\s+(?:text\s+)?in\s+([^\s.]+)/i);
      if (editMatch) {
        return { title: editMatch[1] };
      }
      return { title: "edit" };
    }

    case "ls": {
      // Content IS the directory listing - we don't have the path
      const fileCount = lines.filter(l => l.trim()).length;
      return { title: "ls", subtitle: `${fileCount} items` };
    }

    case "find": {
      // Content IS the find results - we don't have the pattern
      const resultCount = lines.filter(l => l.trim()).length;
      return { title: "find", subtitle: `${resultCount} results` };
    }

    case "grep": {
      // Content IS the grep results
      const matchCount = lines.filter(l => l.trim()).length;
      return { title: "grep", subtitle: `${matchCount} matches` };
    }

    case "webfetch": {
      // Try to find URL in content
      const urlMatch = content.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        const url = urlMatch[1].length > 40 ? urlMatch[1].slice(0, 40) + "…" : urlMatch[1];
        return { title: url };
      }
      return { title: "webfetch" };
    }

    default:
      return { title: toolName };
  }
}

/** Check if content looks like a diff */
function isDiffContent(content: string): boolean {
  const lines = content.split("\n").slice(0, 10);
  return lines.some(line => 
    line.startsWith("+++") || 
    line.startsWith("---") || 
    line.startsWith("@@") ||
    (line.startsWith("+") && !line.startsWith("+++")) ||
    (line.startsWith("-") && !line.startsWith("---"))
  );
}

/**
 * Tool result — terminal-style rendering with scrollable output.
 * 
 * Design: Clear tool name with scrollable content
 * - Header shows tool name and parsed path
 * - Content in scrollable container
 * - Diff content gets +/- coloring
 */
function ToolResultBubble({ message }: { message: ToolResultMessage }): JSX.Element {
  const [expanded, setExpanded] = useState(false);

  // Extract plain text content and strip ANSI codes
  const rawContent = message.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map(b => b.text)
    .join("\n");
  const textContent = stripAnsi(rawContent);

  // Parse header from content
  const header = parseToolHeader(message.toolName, textContent);

  // Get preview line count for this tool
  const previewLineCount = TOOL_PREVIEW_LINES[message.toolName] ?? TOOL_PREVIEW_LINES.default;

  // Split content into lines
  const lines = textContent.split("\n");
  const hasMoreLines = lines.length > previewLineCount;
  const displayLines = expanded ? lines : lines.slice(0, previewLineCount);
  const hiddenLines = lines.length - previewLineCount;

  // Check if this is a diff (for edit tool)
  const isDiff = message.toolName === "edit" || isDiffContent(textContent);

  // For display: tool name, then title (if different), then subtitle
  const displayTitle = header.title !== message.toolName ? header.title : "";

  return (
    <div class="my-2">
      {/* Header — tool name with context info */}
      <div class="font-mono text-sm bg-surface rounded-t px-3 py-2 flex items-center gap-2 flex-wrap overflow-x-auto">
        <span class="text-accent-text font-bold">{message.toolName}</span>
        {displayTitle && (
          <span class="text-text-primary whitespace-pre">{displayTitle}</span>
        )}
        {header.subtitle && (
          <span class="text-text-muted text-xs">({header.subtitle})</span>
        )}
        {message.isError && (
          <span class="text-state-error text-xs">(error)</span>
        )}
      </div>

      {/* Content — scrollable container */}
      {textContent && (
        <div class="bg-surface-2 rounded-b border-t border-border-subtle">
          {expanded ? (
            // Full content — scrollable both directions
            <div class="font-mono text-xs text-text-muted p-3 max-h-96 overflow-auto">
              {isDiff ? (
                <DiffContent lines={lines} />
              ) : (
                <pre class="whitespace-pre">{textContent}</pre>
              )}
            </div>
          ) : (
            // Preview content — tappable to expand
            <button
              type="button"
              onClick={() => setExpanded(true)}
              class="w-full text-left font-mono text-xs text-text-muted p-3 active:bg-border-subtle/50 transition-colors"
            >
              {isDiff ? (
                <DiffContent lines={displayLines} />
              ) : (
                <pre class="whitespace-pre overflow-x-auto">{displayLines.join("\n")}</pre>
              )}
              {hasMoreLines && (
                <div class="text-accent-text mt-1">
                  … {hiddenLines} more lines — tap to expand
                </div>
              )}
            </button>
          )}
          {expanded && hasMoreLines && (
            <div class="px-3 pb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                class="text-xs text-text-muted active:text-text-primary"
              >
                ▲ collapse
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Render diff content with +/- coloring */
function DiffContent({ lines }: { lines: string[] }): JSX.Element {
  return (
    <div class="font-mono overflow-hidden">
      {lines.map((line, i) => {
        let colorClass = "text-text-muted";
        if (line.startsWith("+") && !line.startsWith("+++")) {
          colorClass = "text-state-success";
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          colorClass = "text-state-error";
        } else if (line.startsWith("@@")) {
          colorClass = "text-accent-text";
        }
        return (
          <div key={i} class={`${colorClass} whitespace-pre-wrap break-all`}>
            {line}
          </div>
        );
      })}
    </div>
  );
}

/** Sticky collapse button at the top of expanded content — minimal chrome */
function CollapseButton({ onCollapse }: { onCollapse: () => void }): JSX.Element {
  return (
    <div class="sticky top-12 z-[5] flex justify-end -mb-6">
      <button
        type="button"
        onClick={onCollapse}
        class="text-[10px] text-text-muted/50 active:text-text-primary bg-bg-app/80 backdrop-blur-sm rounded px-2 py-1 min-h-[var(--spacing-touch)] flex items-center justify-center select-none"
        aria-label="Collapse message"
      >
        ▲ collapse
      </button>
    </div>
  );
}

/**
 * Wraps a message with collapsible behavior.
 * 
 * Design: Minimal chrome — no labels, just content
 * - Collapsed: compact preview, tap to expand
 * - Expanded: content + subtle collapse button
 */
function CollapsibleEntry({
  entry,
  collapsed,
  onToggle,
  children,
}: {
  entry: SessionEntry;
  collapsed: boolean;
  onToggle: () => void;
  children: JSX.Element | null;
}): JSX.Element | null {
  if (!children) return null;

  if (collapsed) {
    const preview = getPreviewText(entry);

    // Collapsed state — compact, tappable preview (no labels)
    return (
      <button
        type="button"
        onClick={onToggle}
        class="w-full text-left py-2 px-1 text-text-muted/70 active:text-text-muted transition-colors duration-100 min-h-[var(--spacing-touch)]"
      >
        <span class="text-sm line-clamp-2">{preview}</span>
        <span class="text-xs text-accent-text ml-1">▼</span>
      </button>
    );
  }

  // Expanded state — content with subtle collapse button
  return (
    <div class="relative">
      <CollapseButton onCollapse={onToggle} />
      {children}
    </div>
  );
}

function renderMessageEntry(entry: SessionMessageEntry, searchQuery?: string): JSX.Element | null {
  const msg = entry.message;

  switch (msg.role) {
    case "user": {
      const blocks = extractAllContent(msg.content as string | ContentBlock[]);
      return (
        <ChatBubble role="user">
          <ContentBlocks blocks={blocks} searchQuery={searchQuery} />
        </ChatBubble>
      );
    }

    case "assistant": {
      const blocks = extractAllContent(msg.content);
      return (
        <ChatBubble role="assistant">
          <ContentBlocks blocks={blocks} searchQuery={searchQuery} useMarkdown={true} />
          <AssistantMeta message={msg} />
        </ChatBubble>
      );
    }

    case "toolResult": {
      return <ToolResultBubble message={msg} />;
    }

    case "bashExecution": {
      return <BashExecutionBubble message={msg} />;
    }

    case "compactionSummary": {
      return (
        <ChatBubble role="system" label="Compaction">
          <Metadata class="block mb-1">
            {formatTokens(msg.tokensBefore)} tokens compacted
          </Metadata>
          <div class="whitespace-pre-wrap break-words text-sm text-text-muted">
            <HighlightText text={msg.summary} query={searchQuery} />
          </div>
        </ChatBubble>
      );
    }

    case "branchSummary": {
      return (
        <ChatBubble role="system" label="Branch">
          <div class="whitespace-pre-wrap break-words text-sm text-text-muted">
            <HighlightText text={msg.summary} query={searchQuery} />
          </div>
        </ChatBubble>
      );
    }

    case "custom": {
      if (!msg.display) return null;
      const blocks = extractAllContent(msg.content as string | ContentBlock[]);
      return (
        <ChatBubble role="system" label={msg.customType}>
          <ContentBlocks blocks={blocks} searchQuery={searchQuery} />
        </ChatBubble>
      );
    }

    default:
      return null;
  }
}

function renderEntry(entry: SessionEntry, searchQuery?: string): JSX.Element | null {
  switch (entry.type) {
    case "message":
      return renderMessageEntry(entry, searchQuery);

    case "compaction":
      return (
        <ChatBubble role="system" label="Compaction">
          <Metadata class="block mb-1">
            {formatTokens(entry.tokensBefore)} tokens compacted
          </Metadata>
          <div class="whitespace-pre-wrap break-words text-sm text-text-muted">
            <HighlightText text={entry.summary} query={searchQuery} />
          </div>
        </ChatBubble>
      );

    case "branch_summary":
      return (
        <ChatBubble role="system" label="Branch">
          <div class="whitespace-pre-wrap break-words text-sm text-text-muted">
            <HighlightText text={entry.summary} query={searchQuery} />
          </div>
        </ChatBubble>
      );

    case "custom_message":
      if (!entry.display) return null;
      return (
        <ChatBubble role="system" label={entry.customType}>
          <ContentBlocks blocks={extractAllContent(entry.content as string | ContentBlock[])} searchQuery={searchQuery} />
        </ChatBubble>
      );

    default:
      // Skip non-renderable entries (thinking_level_change, model_change, custom, label, session_info)
      return null;
  }
}

/** Check if an entry is renderable (has visual output) */
function isRenderable(entry: SessionEntry): boolean {
  if (entry.type === "message") {
    const msg = entry.message;
    // Skip custom messages that shouldn't display
    if (msg.role === "custom" && !msg.display) return false;
    // Skip assistant messages with no text content (only tool calls)
    if (msg.role === "assistant" && !assistantHasTextContent(msg.content)) return false;
    return true;
  }
  if (entry.type === "compaction" || entry.type === "branch_summary") return true;
  if (entry.type === "custom_message" && entry.display) return true;
  return false;
}

/**
 * Build a map of entry ID → number of children from the tree structure.
 * Used to detect branch points (entries with >1 child).
 */
function buildChildCountMap(nodes: TreeNode[]): Map<string, number> {
  const map = new Map<string, number>();

  function walk(node: TreeNode): void {
    map.set(node.id, node.childCount);
    for (const child of node.children) {
      walk(child);
    }
  }

  for (const root of nodes) {
    walk(root);
  }

  return map;
}

/**
 * Build a map of entry ID → child TreeNode[] from the tree structure.
 * Used when opening the branch selector.
 */
function buildChildrenMap(nodes: TreeNode[]): Map<string, TreeNode[]> {
  const map = new Map<string, TreeNode[]>();

  function walk(node: TreeNode): void {
    if (node.children.length > 0) {
      map.set(node.id, node.children);
    }
    for (const child of node.children) {
      walk(child);
    }
  }

  for (const root of nodes) {
    walk(root);
  }

  return map;
}

/**
 * Count messages from a tree node down to its deepest leaf (depth-first, first child).
 */
function countBranchDepth(node: TreeNode): number {
  let count = 1;
  let current = node;
  while (current.children.length > 0) {
    count++;
    current = current.children[0];
  }
  return count;
}

/**
 * Get the leaf node following the first-child path from a given node.
 */
function getLeafNode(node: TreeNode): TreeNode {
  let current = node;
  while (current.children.length > 0) {
    current = current.children[0];
  }
  return current;
}

/**
 * Collect all leaf nodes (branches) from the tree.
 * Each leaf represents a unique branch path.
 */
function collectAllBranches(nodes: TreeNode[]): TreeBranch[] {
  const branches: TreeBranch[] = [];

  function walkToLeaves(node: TreeNode, path: TreeNode[]): void {
    const currentPath = [...path, node];
    if (node.children.length === 0) {
      // This is a leaf — represents a complete branch
      const messageNodes = currentPath.filter(
        (n) => n.type === "message"
      );
      const pathDesc = messageNodes
        .slice(0, 3)
        .map((n) => {
          const preview = n.preview.slice(0, 40);
          return preview || n.role || n.type;
        })
        .join(" → ");

      branches.push({
        leafId: node.id,
        pathDescription: messageNodes.length > 3 ? pathDesc + " → …" : pathDesc,
        messageCount: currentPath.length,
        leafPreview: node.preview,
        isActive: false, // Caller sets this
      });
    } else {
      for (const child of node.children) {
        walkToLeaves(child, currentPath);
      }
    }
  }

  for (const root of nodes) {
    walkToLeaves(root, []);
  }

  return branches;
}

export function SessionDetail({ sessionId, onBack, searchQuery, onOpenFiles }: SessionDetailProps): JSX.Element {
  const [data, setData] = useState<SessionDetailData | null>(null);
  const [treeData, setTreeData] = useState<TreeData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const [allCollapsed, setAllCollapsed] = useState(true);
  const [currentLeafId, setCurrentLeafId] = useState<string | null>(null);
  const [branchSelectorOpen, setBranchSelectorOpen] = useState(false);
  const [branchSelectorEntryId, setBranchSelectorEntryId] = useState<string | null>(null);
  const [treeOverviewOpen, setTreeOverviewOpen] = useState(false);
  const [isRpcConnected, setIsRpcConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [activeModel, setActiveModel] = useState<string | undefined>(undefined);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  // Use the auto-scroll hook
  const {
    isAutoScrolling,
    isAtBottom,
    scrollToBottom,
    handleContentChange,
    enableAutoScroll,
    bottomRef,
  } = useAutoScroll({ bottomThreshold: 50 });

  // Derive current model from last assistant message in entries
  const lastAssistantModel = useMemo(() => {
    if (!data) return undefined;
    for (let i = data.entries.length - 1; i >= 0; i--) {
      const entry = data.entries[i];
      if (entry.type === "message" && entry.message.role === "assistant") {
        return entry.message.model;
      }
    }
    return undefined;
  }, [data]);

  // Use activeModel (from model switching) if set, otherwise fall back to last assistant message
  const currentModel = activeModel ?? lastAssistantModel;

  // Compute child count map and children map from tree data
  const childCountMap = useMemo(
    () => (treeData ? buildChildCountMap(treeData.tree) : new Map<string, number>()),
    [treeData]
  );
  const childrenMap = useMemo(
    () => (treeData ? buildChildrenMap(treeData.tree) : new Map<string, TreeNode[]>()),
    [treeData]
  );

  // Compute set of entry IDs on current branch for branch indicator active state
  const currentBranchIds = useMemo(() => {
    if (!data) return new Set<string>();
    return new Set(data.entries.map((e) => e.id));
  }, [data]);

  // Compute all branches for tree overview
  const allBranches = useMemo((): TreeBranch[] => {
    if (!treeData) return [];
    const branches = collectAllBranches(treeData.tree);
    // Only show tree overview if there are actual branches (>1 leaf)
    if (branches.length <= 1) return [];
    // Mark active branch
    const activeLeaf = currentLeafId ?? data?.entries[data.entries.length - 1]?.id;
    return branches.map((b) => ({
      ...b,
      isActive: b.leafId === activeLeaf,
    }));
  }, [treeData, currentLeafId, data]);

  const fetchSession = useCallback(async (leafId?: string) => {
    setLoadState("loading");
    setErrorMessage("");
    try {
      const leafParam = leafId ? `?leafId=${encodeURIComponent(leafId)}` : "";
      const res = await fetch(`/api/session/${encodeURIComponent(sessionId)}${leafParam}`);
      if (res.status === 404) {
        setErrorMessage("Session not found");
        setLoadState("error");
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const result: SessionDetailData = await res.json();
      setData(result);
      setLoadState("idle");
      if (leafId) {
        setCurrentLeafId(leafId);
      }

      // Initialize collapsed state for all entries
      // When navigating from search, expand entries that contain matches
      const initialCollapsed: Record<string, boolean> = {};
      const lowerQuery = searchQuery ? searchQuery.toLowerCase() : "";
      for (const entry of result.entries) {
        if (isRenderable(entry)) {
          if (lowerQuery && getCopyText(entry).toLowerCase().includes(lowerQuery)) {
            // Expand entries with search matches
            initialCollapsed[entry.id] = false;
          } else {
            initialCollapsed[entry.id] = shouldCollapseByDefault(entry);
          }
        }
      }
      setCollapsedMap(initialCollapsed);
      setAllCollapsed(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      setLoadState("error");
    }
  }, [sessionId, searchQuery]);

  /**
   * Handle a new session entry arriving from the file watcher SSE.
   * Appends it to the current entry list in real-time.
   */
  const handleSessionEntry = useCallback((rawEntry: Record<string, unknown>) => {
    const entry = rawEntry as unknown as SessionEntry;
    if (!entry.id || !entry.type) return;

    setData((prev) => {
      if (!prev) return prev;
      // Avoid duplicates
      if (prev.entries.some((e) => e.id === entry.id)) return prev;
      return { ...prev, entries: [...prev.entries, entry] };
    });

    // Set default collapsed state for new entry
    if (isRenderable(entry)) {
      setCollapsedMap((prev) => {
        if (entry.id in prev) return prev;
        return { ...prev, [entry.id]: shouldCollapseByDefault(entry) };
      });
    }
  }, []);

  const fetchTree = useCallback(async () => {
    try {
      const res = await fetch(`/api/tree/${encodeURIComponent(sessionId)}`);
      if (res.ok) {
        const result: TreeData = await res.json();
        setTreeData(result);
      }
    } catch {
      // Tree data is supplementary — don't fail the page if it errors
    }
  }, [sessionId]);

  useEffect(() => {
    void fetchSession();
    void fetchTree();
  }, [fetchSession, fetchTree]);

  // Check if this session already has an active RPC connection.
  // Probe the SSE stream endpoint: 404 means not connected, 200 means connected.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const probeConnection = async (): Promise<void> => {
      try {
        const res = await fetch(`/api/session/${encodeURIComponent(sessionId)}/stream`, {
          signal: controller.signal,
        });
        if (!cancelled && res.ok) {
          setIsRpcConnected(true);
        }
        // Always close the stream — we only needed to check the status code
        res.body?.cancel();
      } catch {
        // Not connected or aborted — that's fine
      }
    };
    void probeConnection();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [sessionId]);

  /** Connect to the session's RPC subprocess */
  const connectToSession = useCallback(async () => {
    setIsConnecting(true);
    try {
      const res = await fetch(`/api/session/${encodeURIComponent(sessionId)}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" })) as { error: string };
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setIsRpcConnected(true);
    } catch (err) {
      console.error("Failed to connect:", err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setIsConnecting(false);
    }
  }, [sessionId]);

  // Scroll to first search match after data loads
  useEffect(() => {
    if (!searchQuery || !data || loadState !== "idle") return;
    // Small delay to allow rendering
    const timer = setTimeout(() => {
      const mark = document.querySelector("mark");
      if (mark) {
        mark.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [searchQuery, data, loadState]);

  const toggleEntry = useCallback((id: string) => {
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleAll = useCallback(() => {
    if (!data) return;
    const newAllCollapsed = !allCollapsed;
    const newMap: Record<string, boolean> = {};
    for (const entry of data.entries) {
      if (isRenderable(entry)) {
        newMap[entry.id] = newAllCollapsed;
      }
    }
    setCollapsedMap(newMap);
    setAllCollapsed(newAllCollapsed);
  }, [data, allCollapsed]);

  /** Abort the current operation */
  const handleAbort = useCallback(async () => {
    try {
      await fetch(`/api/session/${encodeURIComponent(sessionId)}/abort`, {
        method: "POST",
      });
    } catch (err) {
      console.error("Failed to abort:", err);
    }
  }, [sessionId]);

  /** Called when a new streaming message starts */
  const handleNewStreamingMessage = useCallback(() => {
    if (isAutoScrolling) {
      scrollToBottom();
    }
  }, [isAutoScrolling, scrollToBottom]);

  /** Called during streaming activity — show "new messages" pill if not auto-scrolling */
  const handleStreamActivity = useCallback(() => {
    if (isAutoScrolling) {
      handleContentChange();
    } else {
      // Show the "new messages" indicator when auto-scroll is paused
      setHasNewMessages(true);
    }
  }, [isAutoScrolling, handleContentChange]);

  /** Handle tapping the "new messages" pill */
  const handleNewMessagesPillClick = useCallback(() => {
    setHasNewMessages(false);
    enableAutoScroll();
  }, [enableAutoScroll]);

  // Clear "new messages" indicator when user scrolls to bottom
  useEffect(() => {
    if (isAtBottom) {
      setHasNewMessages(false);
    }
  }, [isAtBottom]);

  /** Handle selecting a branch from the branch selector */
  const handleSelectBranch = useCallback((childId: string) => {
    // Find the leaf of the selected child branch in the tree
    if (!treeData) return;

    function findNode(nodes: TreeNode[], targetId: string): TreeNode | null {
      for (const node of nodes) {
        if (node.id === targetId) return node;
        const found = findNode(node.children, targetId);
        if (found) return found;
      }
      return null;
    }

    const childNode = findNode(treeData.tree, childId);
    if (childNode) {
      const leaf = getLeafNode(childNode);
      void fetchSession(leaf.id);
    }
  }, [treeData, fetchSession]);

  /** Handle selecting a branch from the tree overview */
  const handleSelectTreeBranch = useCallback((leafId: string) => {
    void fetchSession(leafId);
  }, [fetchSession]);

  /** Open branch selector for a specific entry */
  const openBranchSelector = useCallback((entryId: string) => {
    setBranchSelectorEntryId(entryId);
    setBranchSelectorOpen(true);
  }, []);

  /** Compute branch options for the currently open branch selector */
  const branchOptions = useMemo((): BranchOption[] => {
    if (!branchSelectorEntryId || !childrenMap.has(branchSelectorEntryId)) return [];
    const children = childrenMap.get(branchSelectorEntryId) ?? [];
    return children.map((child) => {
      const leaf = getLeafNode(child);
      return {
        childId: child.id,
        preview: child.preview,
        depth: countBranchDepth(child),
        leafPreview: leaf.preview,
        isActive: currentBranchIds.has(child.id),
      };
    });
  }, [branchSelectorEntryId, childrenMap, currentBranchIds]);

  // Build toolbar actions
  const toolbarActions = useMemo(() => {
    const actions = [];

    if (!isRpcConnected) {
      actions.push({
        key: "connect",
        label: isConnecting ? "Connecting…" : "Connect",
        onClick: () => void connectToSession(),
        disabled: isConnecting,
        variant: "primary" as const,
      });
    }

    if (onOpenFiles) {
      actions.push({
        key: "files",
        label: "Files",
        onClick: onOpenFiles,
      });
    }

    if (allBranches.length > 0) {
      actions.push({
        key: "tree",
        label: "Tree",
        onClick: () => setTreeOverviewOpen(true),
      });
    }

    actions.push({
      key: "collapse",
      label: allCollapsed ? "Expand" : "Collapse",
      onClick: toggleAll,
    });

    return actions;
  }, [isRpcConnected, isConnecting, connectToSession, onOpenFiles, allBranches.length, allCollapsed, toggleAll]);

  return (
    <div class="min-h-screen bg-bg-app" style="-webkit-overflow-scrolling: touch;">
      {/* Header — minimal with back button and title */}
      <div class="sticky top-0 z-10 bg-bg-app border-b border-border-subtle">
        <Container class="py-3 flex items-center gap-3">
          <IconButton
            label="Back"
            onClick={onBack}
          >
            ←
          </IconButton>
          <Title class="truncate flex-1">
            {data?.header?.cwd
              ? data.header.cwd.split("/").filter(Boolean).pop() ?? "Session"
              : "Session"}
          </Title>
          {isRpcConnected && (
            <Badge variant="accent">Live</Badge>
          )}
          {data && (
            <ModelSwitcher
              sessionId={sessionId}
              isRpcConnected={isRpcConnected}
              currentModel={currentModel}
              onModelChange={setActiveModel}
            />
          )}
        </Container>
      </div>

      {/* Floating toolbar */}
      {data && toolbarActions.length > 0 && (
        <div class="fixed top-16 right-4 z-10">
          <Toolbar actions={toolbarActions} defaultCollapsed={true} />
        </div>
      )}

      {/* Content */}
      <Container class="py-4">
        {loadState === "loading" && !data && (
          <div class="flex justify-center py-16">
            <Metadata>Loading session…</Metadata>
          </div>
        )}

        {loadState === "error" && (
          <div class="bg-state-error/10 text-state-error rounded-lg p-4">
            <Body class="text-state-error">
              {errorMessage}
            </Body>
          </div>
        )}

        {data && (
          <Stack direction="vertical" gap={2}>
            {data.entries.map((entry) => {
              if (!isRenderable(entry)) return null;
              const rendered = renderEntry(entry, searchQuery);
              if (!rendered) return null;
              const branchCount = childCountMap.get(entry.id) ?? 0;

              // Tool-related entries use their own bubbles with built-in expand/collapse
              const isSelfContainedTool = entry.type === "message" && 
                (entry.message.role === "bashExecution" || entry.message.role === "toolResult");

              return (
                <div key={entry.id}>
                  {isSelfContainedTool ? (
                    // Render directly - BashExecutionBubble/ToolResultBubble handle their own state
                    rendered
                  ) : (
                    <CollapsibleEntry
                      entry={entry}
                      collapsed={collapsedMap[entry.id] ?? false}
                      onToggle={() => toggleEntry(entry.id)}
                    >
                      {rendered}
                    </CollapsibleEntry>
                  )}
                  {branchCount > 1 && (
                    <button
                      type="button"
                      onClick={() => openBranchSelector(entry.id)}
                      class="mt-1 min-h-[var(--spacing-touch)] flex items-center gap-2 px-3 py-1 active:opacity-70 transition-opacity duration-100"
                      aria-label={`${branchCount} branches from this point`}
                    >
                      <Badge variant="accent">{branchCount} branches</Badge>
                    </button>
                  )}
                </div>
              );
            })}
          </Stack>
        )}

        {/* Bottom anchor for scroll-to-bottom — with padding for prompt input */}
        <div ref={bottomRef} class={isRpcConnected ? "pb-28" : "pb-4"} />
      </Container>

      {/* Streaming messages (active session only) */}
      {isRpcConnected && (
        <Container class="pb-4">
          <StreamingMessageContainer
            sessionId={sessionId}
            onStreamingChange={setIsStreaming}
            onNewMessage={handleNewStreamingMessage}
            onStreamActivity={handleStreamActivity}
            onSessionEntry={handleSessionEntry}
          />
        </Container>
      )}

      {/* Prompt input (active session only) */}
      {isRpcConnected && (
        <div class="fixed bottom-0 left-0 right-0 z-20">
          <PromptInput
            sessionId={sessionId}
            isStreaming={isStreaming}
            onAbort={handleAbort}
            onPromptSent={scrollToBottom}
          />
        </div>
      )}

      {/* "New messages" pill — shown when auto-scroll is paused and new content arrives */}
      {hasNewMessages && !isAtBottom && (
        <button
          type="button"
          onClick={handleNewMessagesPillClick}
          class={`fixed ${isRpcConnected ? "bottom-20" : "bottom-6"} left-1/2 -translate-x-1/2 z-20 bg-accent text-on-accent rounded-full px-4 py-2 text-sm font-medium shadow-lg active:bg-accent-hover transition-colors duration-100`}
          aria-label="Jump to new messages"
        >
          New messages ↓
        </button>
      )}

      {/* Scroll-to-bottom floating button — visible when not at bottom */}
      {!isAtBottom && !hasNewMessages && (
        <button
          type="button"
          onClick={scrollToBottom}
          class={`fixed ${isRpcConnected ? "bottom-20" : "bottom-6"} right-6 z-20 bg-accent text-on-accent rounded-full w-12 h-12 flex items-center justify-center shadow-lg active:bg-accent-hover transition-colors duration-100`}
          aria-label="Jump to bottom"
        >
          ↓
        </button>
      )}

      {/* Branch selector BottomSheet */}
      <BranchSelector
        open={branchSelectorOpen}
        onClose={() => setBranchSelectorOpen(false)}
        branches={branchOptions}
        onSelectBranch={handleSelectBranch}
      />

      {/* Tree overview BottomSheet */}
      <TreeOverview
        open={treeOverviewOpen}
        onClose={() => setTreeOverviewOpen(false)}
        branches={allBranches}
        onSelectBranch={handleSelectTreeBranch}
      />
    </div>
  );
}
