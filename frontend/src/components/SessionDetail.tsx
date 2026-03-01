import type { JSX } from "preact";
import { useState, useEffect, useCallback, useMemo, useRef } from "preact/hooks";
import {
  Badge,
  Body,
  BottomSheet,
  ChatBubble,
  Container,
  IconButton,
  MarkdownRenderer,
  Metadata,
  Stack,
  SwipeableRow,
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
import { MobileComposer } from "./MobileComposer.js";
import { StreamingMessageContainer } from "./StreamingMessage.js";
import { ModelSwitcher } from "./ModelSwitcher.js";

import { useAutoScroll } from "../hooks/useAutoScroll.js";
import { usePromptState } from "../hooks/usePromptState.js";
import type { HistoryMessage } from "./HistoryPickerSheet.js";
import { ForkActionSheet } from "./ForkActionSheet.js";
import { 
  BashExecutionBubble as SharedBashBubble, 
  ToolResultBubble as SharedToolBubble 
} from "./ToolDisplay.js";

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

/** Conversation filter modes matching pi CLI */
type ConversationFilter = "all" | "no-tools" | "user" | "labeled";

/** Filter labels for display */
const FILTER_LABELS: Record<ConversationFilter, string> = {
  "all": "All",
  "no-tools": "No Tools",
  "user": "User",
  "labeled": "Labeled",
};

/** All filter options in order */
const FILTER_OPTIONS: ConversationFilter[] = ["all", "no-tools", "user", "labeled"];

/** Filter entries based on the selected filter mode */
function filterEntries(entries: SessionEntry[], filter: ConversationFilter): SessionEntry[] {
  switch (filter) {
    case "no-tools":
      // Hide tool results and bash executions
      return entries.filter(e => {
        if (e.type !== "message") return true;
        const role = e.message.role;
        return role !== "toolResult" && role !== "bashExecution";
      });
    case "user":
      // Show only user messages
      return entries.filter(e => 
        e.type === "message" && e.message.role === "user"
      );
    case "labeled":
      // Show only labeled entries (entries with type "label" or that have labels)
      // Note: Label entries reference other entries, so we show entries that are labeled
      return entries.filter(e => e.type === "label");
    case "all":
    default:
      // Show all renderable entries
      return entries.filter(e => isRenderable(e));
  }
}

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
 * User and assistant messages are NEVER collapsed (per PRD 3.2).
 * Tool results, bash executions, and summaries are collapsed.
 */
function shouldCollapseByDefault(entry: SessionEntry): boolean {
  if (entry.type !== "message") {
    // compaction, branch_summary, custom_message — always collapse
    return true;
  }

  const msg = entry.message;

  switch (msg.role) {
    case "user":
      // User messages: NEVER collapse (per PRD 3.2)
      return false;
    case "assistant":
      // Assistant messages: NEVER collapse (per PRD 3.2)
      // Skip assistant messages with no text content (only tool calls)
      if (!assistantHasTextContent(msg.content)) return true;
      return false;
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
            // Thinking text — always inline muted italic (per PRD 3.2, matches pi CLI)
            const thinkingText = block.text.trim();
            
            if (block.redacted) {
              return (
                <div key={i} class="text-sm text-text-muted/60 italic">
                  (thinking redacted)
                </div>
              );
            }
            
            // Always render thinking inline — no collapse
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

/**
 * Wrapper for BashExecutionMessage → SharedBashBubble.
 * Uses the shared terminal-style component from ToolDisplay.tsx.
 */
function BashExecutionBubble({ message }: { message: BashExecutionMessage }): JSX.Element {
  return (
    <SharedBashBubble
      command={message.command}
      output={message.output}
      exitCode={message.exitCode}
      cancelled={message.cancelled}
      truncated={message.truncated}
    />
  );
}

/**
 * Wrapper for ToolResultMessage → SharedToolBubble.
 * Uses the shared terminal-style component from ToolDisplay.tsx.
 */
function ToolResultBubble({ message }: { message: ToolResultMessage }): JSX.Element {
  // Extract plain text content
  const rawContent = message.content
    .filter((b): b is { type: "text"; text: string } => b.type === "text")
    .map(b => b.text)
    .join("\n");

  return (
    <SharedToolBubble
      toolName={message.toolName}
      content={rawContent}
      isError={message.isError}
    />
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
  const [composerOpen, setComposerOpen] = useState(false);
  const [forkSheetOpen, setForkSheetOpen] = useState(false);
  const [forkEntryId, setForkEntryId] = useState<string | null>(null);
  const [forkLoading, setForkLoading] = useState(false);
  const [conversationFilter, setConversationFilter] = useState<ConversationFilter>("all");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // Use the auto-scroll hook
  const {
    isAutoScrolling,
    isAtBottom,
    scrollToBottom,
    handleContentChange,
    enableAutoScroll,
    scrollContainerRef,
    bottomRef,
  } = useAutoScroll({ bottomThreshold: 50 });

  // Shared prompt state for PromptInput and MobileComposer
  const promptState = usePromptState({
    sessionId,
    onPromptSent: scrollToBottom,
  });

  // Extract user messages for history picker
  const historyMessages: HistoryMessage[] = useMemo(() => {
    if (!data) return [];
    const messages: HistoryMessage[] = [];
    for (const entry of data.entries) {
      if (entry.type === "message" && entry.message.role === "user") {
        const userMsg = entry.message as UserMessage;
        messages.push({
          id: entry.id,
          text: extractPlainText(userMsg.content),
          timestamp: userMsg.timestamp,
        });
      }
    }
    return messages;
  }, [data]);

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
  // Tree view is available for all sessions (including single-branch linear sessions)
  const allBranches = useMemo((): TreeBranch[] => {
    if (!treeData) return [];
    const branches = collectAllBranches(treeData.tree);
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
        // Session not found in historical data - this is OK for new sessions
        // Set data to empty state and continue (RPC connection will be checked separately)
        setData({ header: null, entries: [] });
        setLoadState("idle");
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
    
    // Debug: log incoming entries
    console.log("[SessionDetail] Received session_entry:", entry.type, entry.type === "message" ? (entry as SessionMessageEntry).message?.role : "", entry.id);
    
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

    // Auto-scroll to show the new entry
    if (isAutoScrolling) {
      // Small delay to let React render the new entry
      setTimeout(() => {
        scrollToBottom();
      }, 50);
    }
  }, [isAutoScrolling, scrollToBottom]);

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

  // Track if we've done initial scroll
  const hasInitialScrolled = useRef(false);

  useEffect(() => {
    void fetchSession();
    void fetchTree();
  }, [fetchSession, fetchTree]);

  // Scroll to bottom when data first loads
  useEffect(() => {
    if (data && loadState === "idle" && !hasInitialScrolled.current) {
      hasInitialScrolled.current = true;
      // Give the DOM time to render, then scroll to bottom
      const timer = setTimeout(() => {
        scrollToBottom();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [data, loadState, scrollToBottom]);

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
      // Scroll to bottom after connecting
      setTimeout(() => scrollToBottom(), 200);
    } catch (err) {
      console.error("Failed to connect:", err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to connect");
    } finally {
      setIsConnecting(false);
    }
  }, [sessionId, scrollToBottom]);

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
      // Directly scroll to bottom during streaming for reliability
      scrollToBottom();
    } else {
      // Show the "new messages" indicator when auto-scroll is paused
      setHasNewMessages(true);
    }
  }, [isAutoScrolling, scrollToBottom]);

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

  /** Open fork action sheet for a specific entry */
  const openForkSheet = useCallback((entryId: string) => {
    setForkEntryId(entryId);
    setForkSheetOpen(true);
  }, []);

  /** Handle fork action */
  const handleFork = useCallback(async () => {
    if (!forkEntryId || !isRpcConnected) return;

    setForkLoading(true);
    try {
      console.log("[Fork] Sending fork request:", { entryId: forkEntryId });
      const res = await fetch(`/api/session/${encodeURIComponent(sessionId)}/fork`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entryId: forkEntryId,
        }),
      });

      const data = await res.json().catch(() => ({ error: "Invalid response" })) as Record<string, unknown>;
      console.log("[Fork] Response:", res.status, data);

      if (!res.ok) {
        const errorMsg = (data.error as string) || `HTTP ${res.status}`;
        throw new Error(errorMsg);
      }

      // Fork successful - fetch the forked branch (ending at the fork entry)
      // This shows the session "rewound" to the fork point
      await fetchSession(forkEntryId);
      await fetchTree();
      
      // Update current leaf to the fork point
      setCurrentLeafId(forkEntryId);

      // Close the fork sheet
      setForkSheetOpen(false);
      setForkEntryId(null);
      
      // Scroll to bottom (which is now the fork point)
      scrollToBottom();
    } catch (err) {
      console.error("Fork failed:", err);
      // Close the sheet and show error
      setForkSheetOpen(false);
      setForkEntryId(null);
      const message = err instanceof Error ? err.message : "Fork failed";
      setErrorMessage(message);
      // Also alert so user sees it immediately
      alert(`Fork failed: ${message}`);
    } finally {
      setForkLoading(false);
    }
  }, [forkEntryId, isRpcConnected, sessionId, fetchSession, fetchTree, scrollToBottom]);

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

    // Always show Tree button - tree view is useful for all sessions
    actions.push({
      key: "tree",
      label: "Tree",
      onClick: () => setTreeOverviewOpen(true),
    });

    actions.push({
      key: "collapse",
      label: allCollapsed ? "Expand" : "Collapse",
      onClick: toggleAll,
    });

    return actions;
  }, [isRpcConnected, isConnecting, connectToSession, onOpenFiles, allCollapsed, toggleAll]);

  // Calculate input height for floating buttons positioning
  const inputHeightClass = isRpcConnected ? "bottom-20" : "bottom-6";

  return (
    <div class="h-dvh flex flex-col bg-bg-app">
      {/* Header — fixed at top, never scrolls */}
      <div class="flex-shrink-0 z-10 bg-bg-app border-b border-border-subtle">
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
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            class="min-h-[var(--spacing-touch)] min-w-[var(--spacing-touch)] flex items-center justify-center"
            aria-label="Change filter"
          >
            <Badge variant={conversationFilter === "all" ? "default" : "accent"}>
              {FILTER_LABELS[conversationFilter]}
            </Badge>
          </button>
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

      {/* Scrollable content area — takes remaining space, scrolls independently */}
      <div 
        ref={scrollContainerRef}
        class="flex-1 overflow-y-auto overscroll-contain"
        style="-webkit-overflow-scrolling: touch;"
      >
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
              {filterEntries(data.entries, conversationFilter).map((entry) => {
                // filterEntries already handles filtering, just render
                const rendered = renderEntry(entry, searchQuery);
                if (!rendered) return null;
                const branchCount = childCountMap.get(entry.id) ?? 0;

                // Tool-related entries use their own bubbles with built-in expand/collapse
                const isSelfContainedTool = entry.type === "message" && 
                  (entry.message.role === "bashExecution" || entry.message.role === "toolResult");

                // Determine if this entry is swipeable for fork (user messages only)
                // Pi's fork command only works with user message entry IDs
                const isSwipeable = isRpcConnected && entry.type === "message" && 
                  entry.message.role === "user";

                const messageContent = (
                  <>
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
                  </>
                );

                return (
                  <div key={entry.id}>
                    {isSwipeable ? (
                      <SwipeableRow
                        actions={
                          <button
                            type="button"
                            onClick={() => openForkSheet(entry.id)}
                            class="h-full w-full bg-accent text-on-accent flex items-center justify-center font-medium text-sm active:bg-accent-hover"
                          >
                            Fork
                          </button>
                        }
                      >
                        {messageContent}
                      </SwipeableRow>
                    ) : (
                      messageContent
                    )}
                  </div>
                );
              })}
            </Stack>
          )}

          {/* Streaming messages (active session only) */}
          {isRpcConnected && (
            <div class="mt-4">
              <StreamingMessageContainer
                sessionId={sessionId}
                onStreamingChange={setIsStreaming}
                onNewMessage={handleNewStreamingMessage}
                onStreamActivity={handleStreamActivity}
                onSessionEntry={handleSessionEntry}
              />
            </div>
          )}

          {/* Bottom anchor for scroll-to-bottom */}
          <div ref={bottomRef} class="h-4" />
        </Container>
      </div>

      {/* Prompt input — fixed at bottom of flex container, never overlaps content */}
      {isRpcConnected && (
        <div class="flex-shrink-0 z-20">
          <PromptInput
            promptState={promptState}
            isStreaming={isStreaming}
            onAbort={handleAbort}
            onExpandComposer={() => setComposerOpen(true)}
          />
        </div>
      )}

      {/* Mobile Composer (full-screen editor) */}
      {isRpcConnected && (
        <MobileComposer
          open={composerOpen}
          onClose={() => setComposerOpen(false)}
          sessionId={sessionId}
          promptState={promptState}
          historyMessages={historyMessages}
          isStreaming={isStreaming}
        />
      )}

      {/* "New messages" pill — shown when auto-scroll is paused and new content arrives */}
      {hasNewMessages && !isAtBottom && (
        <button
          type="button"
          onClick={handleNewMessagesPillClick}
          class={`fixed ${inputHeightClass} left-1/2 -translate-x-1/2 z-30 bg-accent text-on-accent rounded-full px-4 py-2 text-sm font-medium shadow-lg active:bg-accent-hover transition-colors duration-100`}
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
          class={`fixed ${inputHeightClass} right-6 z-30 bg-accent text-on-accent rounded-full w-12 h-12 flex items-center justify-center shadow-lg active:bg-accent-hover transition-colors duration-100`}
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

      {/* Fork action sheet */}
      <ForkActionSheet
        open={forkSheetOpen}
        onClose={() => {
          setForkSheetOpen(false);
          setForkEntryId(null);
        }}
        entryId={forkEntryId ?? ""}
        onFork={handleFork}
        loading={forkLoading}
      />

      {/* Filter selection BottomSheet */}
      <BottomSheet
        open={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        title="Filter Messages"
      >
        <div class="space-y-1">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setConversationFilter(option);
                setFilterSheetOpen(false);
              }}
              class={`w-full text-left px-4 py-3 rounded-lg min-h-[var(--spacing-touch)] transition-colors duration-100 ${
                conversationFilter === option
                  ? "bg-accent/20 text-accent-text"
                  : "text-text-primary active:bg-surface-2"
              }`}
            >
              {FILTER_LABELS[option]}
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
