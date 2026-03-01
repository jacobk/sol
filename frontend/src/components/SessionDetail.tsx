import type { JSX } from "preact";
import { useState, useEffect, useCallback, useRef } from "preact/hooks";
import {
  Badge,
  Body,
  Button,
  ChatBubble,
  CodeText,
  Container,
  IconButton,
  Metadata,
  Stack,
  Title,
} from "./ui/index.js";
import {
  extractAllContent,
  extractPlainText,
  type ContentBlock,
  type ExtractedContent,
} from "../utils/content.js";

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

type LoadState = "idle" | "loading" | "error";

interface SessionDetailProps {
  sessionId: string;
  onBack: () => void;
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
      const hasTextContent = msg.content.some(
        (b: ContentBlock) => b.type === "text" && b.text.trim().length > 0
      );
      if (!hasTextContent) return true; // tool-call-only responses
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

/** Copy button that shows brief feedback */
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
      {copied ? "✓ Copied" : "📋 Copy"}
    </button>
  );
}

/** Renders content blocks from extractAllContent */
function ContentBlocks({ blocks }: { blocks: ExtractedContent[] }): JSX.Element {
  return (
    <>
      {blocks.map((block, i) => {
        switch (block.type) {
          case "text":
            return (
              <div key={i} class="whitespace-pre-wrap break-words">
                {block.text}
              </div>
            );
          case "thinking":
            return (
              <details key={i} class="mt-2">
                <summary class="text-sm text-text-muted cursor-pointer select-none min-h-[var(--spacing-touch)] flex items-center">
                  💭 Thinking{block.redacted ? " (redacted)" : ""}
                </summary>
                <div class="mt-1 pl-3 border-l-2 border-border-subtle text-sm text-text-muted whitespace-pre-wrap break-words">
                  {block.text}
                </div>
              </details>
            );
          case "toolCall":
            return (
              <div key={i} class="mt-1">
                <Badge variant="accent">{block.toolName}</Badge>
                <CodeText class="mt-1 text-xs">{block.toolArgs}</CodeText>
              </div>
            );
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

/** Wraps a message with collapsible behavior and copy button */
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

  const copyText = getCopyText(entry);

  if (collapsed) {
    const preview = getPreviewText(entry);
    // Determine the role label for collapsed preview
    let roleLabel = "";
    if (entry.type === "message") {
      const role = entry.message.role;
      if (role === "toolResult") roleLabel = `🔧 ${entry.message.toolName}`;
      else if (role === "bashExecution") roleLabel = `$ ${entry.message.command.slice(0, 60)}`;
      else if (role === "assistant") roleLabel = "Assistant";
      else if (role === "compactionSummary") roleLabel = "Compaction";
      else if (role === "branchSummary") roleLabel = "Branch";
      else if (role === "custom") roleLabel = entry.message.customType;
    } else if (entry.type === "compaction") roleLabel = "Compaction";
    else if (entry.type === "branch_summary") roleLabel = "Branch";
    else if (entry.type === "custom_message") roleLabel = entry.customType;

    return (
      <button
        type="button"
        onClick={onToggle}
        class="w-full text-left bg-surface rounded-lg px-4 py-3 border-l-3 border-l-border-subtle active:bg-surface-2 transition-colors duration-100 min-h-[var(--spacing-touch)]"
      >
        {roleLabel && (
          <span class="text-xs font-medium text-text-muted uppercase tracking-wide block mb-1">
            {roleLabel}
          </span>
        )}
        <span class="text-sm text-text-muted line-clamp-2">{preview}</span>
      </button>
    );
  }

  return (
    <div>
      {children}
      <div class="flex items-center justify-end gap-1 mt-1">
        <CopyButton text={copyText} />
        <button
          type="button"
          onClick={onToggle}
          class="text-xs text-text-muted active:text-text-primary min-w-[var(--spacing-touch)] min-h-[var(--spacing-touch)] flex items-center justify-center select-none"
          aria-label="Collapse message"
        >
          ▲ Less
        </button>
      </div>
    </div>
  );
}

function renderMessageEntry(entry: SessionMessageEntry): JSX.Element | null {
  const msg = entry.message;

  switch (msg.role) {
    case "user": {
      const blocks = extractAllContent(msg.content as string | ContentBlock[]);
      return (
        <ChatBubble role="user">
          <ContentBlocks blocks={blocks} />
        </ChatBubble>
      );
    }

    case "assistant": {
      const blocks = extractAllContent(msg.content);
      return (
        <ChatBubble role="assistant">
          <ContentBlocks blocks={blocks} />
          <AssistantMeta message={msg} />
        </ChatBubble>
      );
    }

    case "toolResult": {
      const blocks = extractAllContent(msg.content);
      return (
        <ChatBubble role="tool-result" label={msg.toolName}>
          {msg.isError && (
            <Badge variant="error" class="mb-2">Error</Badge>
          )}
          <ContentBlocks blocks={blocks} />
        </ChatBubble>
      );
    }

    case "bashExecution": {
      return (
        <ChatBubble role="tool" label="Bash">
          <CodeText class="mb-2">$ {msg.command}</CodeText>
          {msg.output && (
            <CodeText class="text-xs max-h-64 overflow-y-auto">
              {msg.output}
            </CodeText>
          )}
          {msg.exitCode !== undefined && msg.exitCode !== 0 && (
            <Badge variant="error" class="mt-2">Exit {msg.exitCode}</Badge>
          )}
          {msg.cancelled && (
            <Badge variant="warning" class="mt-2">Cancelled</Badge>
          )}
        </ChatBubble>
      );
    }

    case "compactionSummary": {
      return (
        <ChatBubble role="system" label="Compaction">
          <Metadata class="block mb-1">
            {formatTokens(msg.tokensBefore)} tokens compacted
          </Metadata>
          <div class="whitespace-pre-wrap break-words text-sm text-text-muted">
            {msg.summary}
          </div>
        </ChatBubble>
      );
    }

    case "branchSummary": {
      return (
        <ChatBubble role="system" label="Branch">
          <div class="whitespace-pre-wrap break-words text-sm text-text-muted">
            {msg.summary}
          </div>
        </ChatBubble>
      );
    }

    case "custom": {
      if (!msg.display) return null;
      const blocks = extractAllContent(msg.content as string | ContentBlock[]);
      return (
        <ChatBubble role="system" label={msg.customType}>
          <ContentBlocks blocks={blocks} />
        </ChatBubble>
      );
    }

    default:
      return null;
  }
}

function renderEntry(entry: SessionEntry): JSX.Element | null {
  switch (entry.type) {
    case "message":
      return renderMessageEntry(entry);

    case "compaction":
      return (
        <ChatBubble role="system" label="Compaction">
          <Metadata class="block mb-1">
            {formatTokens(entry.tokensBefore)} tokens compacted
          </Metadata>
          <div class="whitespace-pre-wrap break-words text-sm text-text-muted">
            {entry.summary}
          </div>
        </ChatBubble>
      );

    case "branch_summary":
      return (
        <ChatBubble role="system" label="Branch">
          <div class="whitespace-pre-wrap break-words text-sm text-text-muted">
            {entry.summary}
          </div>
        </ChatBubble>
      );

    case "custom_message":
      if (!entry.display) return null;
      return (
        <ChatBubble role="system" label={entry.customType}>
          <ContentBlocks blocks={extractAllContent(entry.content as string | ContentBlock[])} />
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
    if (entry.message.role === "custom" && !entry.message.display) return false;
    return true;
  }
  if (entry.type === "compaction" || entry.type === "branch_summary") return true;
  if (entry.type === "custom_message" && entry.display) return true;
  return false;
}

export function SessionDetail({ sessionId, onBack }: SessionDetailProps): JSX.Element {
  const [data, setData] = useState<SessionDetailData | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});
  const [allCollapsed, setAllCollapsed] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const fetchSession = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage("");
    try {
      const res = await fetch(`/api/session/${encodeURIComponent(sessionId)}`);
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

      // Initialize collapsed state for all entries
      const initialCollapsed: Record<string, boolean> = {};
      for (const entry of result.entries) {
        if (isRenderable(entry)) {
          initialCollapsed[entry.id] = shouldCollapseByDefault(entry);
        }
      }
      setCollapsedMap(initialCollapsed);
      setAllCollapsed(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      setLoadState("error");
    }
  }, [sessionId]);

  useEffect(() => {
    void fetchSession();
  }, [fetchSession]);

  // Track scroll position to show/hide "jump to bottom" button
  useEffect(() => {
    const handleScroll = (): void => {
      const scrollTop = window.scrollY;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;
      // Show button when more than 2 screens from bottom
      setShowScrollToBottom(docHeight - scrollTop - windowHeight > windowHeight * 2);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div ref={scrollContainerRef} class="min-h-screen bg-bg-app" style="-webkit-overflow-scrolling: touch;">
      {/* Header */}
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
          {data && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleAll}
            >
              {allCollapsed ? "Expand" : "Collapse"}
            </Button>
          )}
        </Container>
      </div>

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
          <Stack direction="vertical" gap={3}>
            {data.entries.map((entry) => {
              if (!isRenderable(entry)) return null;
              const rendered = renderEntry(entry);
              if (!rendered) return null;
              return (
                <div key={entry.id}>
                  <CollapsibleEntry
                    entry={entry}
                    collapsed={collapsedMap[entry.id] ?? false}
                    onToggle={() => toggleEntry(entry.id)}
                  >
                    {rendered}
                  </CollapsibleEntry>
                </div>
              );
            })}
          </Stack>
        )}

        {/* Bottom anchor for scroll-to-bottom */}
        <div ref={bottomRef} />
      </Container>

      {/* Jump to bottom floating button */}
      {showScrollToBottom && (
        <button
          type="button"
          onClick={scrollToBottom}
          class="fixed bottom-6 right-6 z-20 bg-accent text-white rounded-full w-12 h-12 flex items-center justify-center shadow-lg active:bg-accent-hover transition-colors duration-100"
          aria-label="Jump to bottom"
        >
          ↓
        </button>
      )}
    </div>
  );
}
