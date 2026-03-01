import type { JSX } from "preact";
import { useState, useEffect, useRef, useCallback } from "preact/hooks";
import { ChatBubble, Badge, Metadata } from "./ui/index.js";

/** Represents a tool execution in progress or completed */
interface ToolExecution {
  id: string;
  toolName: string;
  status: "running" | "done" | "error";
  content?: string;
}

/** A single streaming message being assembled from SSE events */
interface StreamingMessageData {
  role: "assistant";
  textContent: string;
  thinkingContent: string;
  model?: string;
  isComplete: boolean;
}

/** Props for the SSE-connected streaming container */
interface StreamingMessageContainerProps {
  sessionId: string;
  onStreamingChange: (isStreaming: boolean) => void;
  onNewMessage?: () => void;
  onStreamActivity?: () => void;
  /** Called when a new session entry is written to the file by any pi process */
  onSessionEntry?: (entry: Record<string, unknown>) => void;
}

/** Individual streaming message renderer — appends text tokens to the DOM */
function StreamingMessageBubble({
  message,
}: {
  message: StreamingMessageData;
}): JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

  // Incrementally append only new text to the DOM
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const text = message.textContent;
    const prevLen = prevLengthRef.current;

    if (text.length > prevLen) {
      // Append only the delta
      el.appendChild(document.createTextNode(text.slice(prevLen)));
    } else if (text.length < prevLen) {
      // Content was reset or replaced
      el.textContent = text;
    }

    prevLengthRef.current = text.length;
  }, [message.textContent]);

  return (
    <ChatBubble role="assistant">
      <div
        ref={contentRef}
        class="whitespace-pre-wrap break-words"
      />
      {!message.isComplete && (
        <span class="inline-block w-2 h-4 bg-accent animate-pulse ml-0.5 align-text-bottom rounded-sm" />
      )}
      {message.model && message.isComplete && (
        <div class="mt-2">
          <Badge variant="accent">{message.model}</Badge>
        </div>
      )}
    </ChatBubble>
  );
}

/** Compact tool execution indicator — collapsed by default, expandable on tap */
function ToolExecutionIndicator({
  tool,
}: {
  tool: ToolExecution;
}): JSX.Element {
  const [expanded, setExpanded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setExpanded(!expanded)}
      class="w-full text-left bg-surface rounded-lg px-4 py-2 border-l-3 border-l-role-tool active:bg-surface-2 transition-colors duration-100 min-h-[var(--spacing-touch)]"
    >
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-text-muted uppercase tracking-wide">
          🔧 {tool.toolName}
        </span>
        {tool.status === "running" && (
          <span class="w-2 h-2 rounded-full bg-accent animate-pulse" />
        )}
        {tool.status === "done" && (
          <Metadata>✓</Metadata>
        )}
        {tool.status === "error" && (
          <Badge variant="error">✕</Badge>
        )}
        <span class="ml-auto text-xs text-text-muted">
          {expanded ? "▲" : "▼"}
        </span>
      </div>
      {expanded && tool.content && (
        <div class="mt-2 text-sm text-text-muted whitespace-pre-wrap break-words max-h-64 overflow-y-auto">
          {tool.content}
        </div>
      )}
    </button>
  );
}

/**
 * Extract plain text from a content array (as returned in pi RPC messages).
 * Content may be a string or array of {type, text} blocks.
 */
function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return (content as Array<Record<string, unknown>>)
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("");
}

/**
 * StreamingMessage container that connects to the SSE stream
 * and renders messages incrementally as they arrive.
 */
export function StreamingMessageContainer({
  sessionId,
  onStreamingChange,
  onNewMessage,
  onStreamActivity,
  onSessionEntry,
}: StreamingMessageContainerProps): JSX.Element {
  const [currentMessage, setCurrentMessage] = useState<StreamingMessageData | null>(null);
  const [tools, setTools] = useState<ToolExecution[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setConnectionStatus("connecting");

    const es = new EventSource(`/api/session/${encodeURIComponent(sessionId)}/stream`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setConnectionStatus("connected");
      reconnectAttemptsRef.current = 0;
    };

    es.onmessage = (event: MessageEvent) => {
      let data: Record<string, unknown>;
      try {
        data = JSON.parse(event.data as string) as Record<string, unknown>;
      } catch {
        return;
      }

      const eventType = data.type as string;

      switch (eventType) {
        case "connected":
          setConnectionStatus("connected");
          break;

        case "session_entry": {
          // New entry written to the session file (by any pi process)
          const entry = data.entry as Record<string, unknown> | undefined;
          if (entry) {
            onSessionEntry?.(entry);
            onStreamActivity?.();
          }
          break;
        }

        case "agent_start":
          // New agent run — clear previous streaming state
          setCurrentMessage({
            role: "assistant",
            textContent: "",
            thinkingContent: "",
            isComplete: false,
          });
          setTools([]);
          onStreamingChange(true);
          onStreamActivity?.();
          break;

        case "message_start": {
          // A new message is starting — reset current message
          const msg = data.message as Record<string, unknown> | undefined;
          setCurrentMessage({
            role: "assistant",
            textContent: "",
            thinkingContent: "",
            model: msg?.model as string | undefined,
            isComplete: false,
          });
          break;
        }

        case "message_update": {
          const msg = data.message as Record<string, unknown> | undefined;
          const delta = data.assistantMessageEvent as Record<string, unknown> | undefined;

          if (!delta) break;

          const deltaType = delta.type as string;

          if (deltaType === "text_delta") {
            const deltaText = (delta.delta as string) ?? "";
            setCurrentMessage((prev) => {
              if (!prev) {
                return {
                  role: "assistant",
                  textContent: deltaText,
                  thinkingContent: "",
                  model: msg?.model as string | undefined,
                  isComplete: false,
                };
              }
              return {
                ...prev,
                textContent: prev.textContent + deltaText,
                model: (msg?.model as string | undefined) ?? prev.model,
              };
            });
            onStreamActivity?.();
          } else if (deltaType === "thinking_delta") {
            const deltaText = (delta.delta as string) ?? "";
            setCurrentMessage((prev) => {
              if (!prev) {
                return {
                  role: "assistant",
                  textContent: "",
                  thinkingContent: deltaText,
                  model: msg?.model as string | undefined,
                  isComplete: false,
                };
              }
              return {
                ...prev,
                thinkingContent: prev.thinkingContent + deltaText,
              };
            });
          } else if (deltaType === "done" || deltaType === "error") {
            setCurrentMessage((prev) => {
              if (!prev) return prev;
              return { ...prev, isComplete: true };
            });
          }
          break;
        }

        case "message_end": {
          setCurrentMessage((prev) => {
            if (!prev) return prev;
            return { ...prev, isComplete: true };
          });
          break;
        }

        case "agent_end":
          setCurrentMessage((prev) => {
            if (!prev) return prev;
            return { ...prev, isComplete: true };
          });
          onStreamingChange(false);
          onNewMessage?.();
          break;

        case "tool_execution_start": {
          const toolId = (data.toolCallId as string) ?? `tool-${Date.now()}`;
          const toolName = (data.toolName as string) ?? "tool";
          setTools((prev) => [
            ...prev,
            { id: toolId, toolName, status: "running" },
          ]);
          break;
        }

        case "tool_execution_update": {
          const toolId = data.toolCallId as string;
          const partialResult = data.partialResult as Record<string, unknown> | undefined;
          const content = partialResult ? extractTextFromContent(partialResult.content) : undefined;

          if (toolId) {
            setTools((prev) =>
              prev.map((t) =>
                t.id === toolId
                  ? { ...t, content: content ?? t.content }
                  : t
              )
            );
          }
          break;
        }

        case "tool_execution_end": {
          const toolId = data.toolCallId as string;
          const isError = (data.isError as boolean) ?? false;
          const result = data.result as Record<string, unknown> | undefined;
          const content = result ? extractTextFromContent(result.content) : undefined;

          if (toolId) {
            setTools((prev) =>
              prev.map((t) =>
                t.id === toolId
                  ? { ...t, status: isError ? "error" : "done", content: content ?? t.content }
                  : t
              )
            );
          }
          break;
        }

        case "rpc_exit":
        case "rpc_error":
          onStreamingChange(false);
          setConnectionStatus("disconnected");
          break;

        default:
          break;
      }
    };

    es.onerror = () => {
      es.close();
      setConnectionStatus("disconnected");
      onStreamingChange(false);

      // Auto-reconnect with exponential backoff
      const attempt = reconnectAttemptsRef.current;
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      reconnectAttemptsRef.current = attempt + 1;

      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [sessionId, onStreamingChange, onNewMessage, onStreamActivity, onSessionEntry]);

  useEffect(() => {
    connect();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [connect]);

  return (
    <div class="space-y-3">
      {/* Connection status indicator */}
      {connectionStatus === "connecting" && (
        <div class="flex items-center gap-2 px-4 py-2">
          <span class="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <Metadata>Connecting to session…</Metadata>
        </div>
      )}
      {connectionStatus === "disconnected" && (
        <div class="flex items-center gap-2 px-4 py-2">
          <span class="w-2 h-2 rounded-full bg-state-error" />
          <Metadata>Disconnected. Reconnecting…</Metadata>
        </div>
      )}
      {connectionStatus === "connected" && !currentMessage && tools.length === 0 && (
        <div class="flex items-center gap-2 px-4 py-2">
          <span class="w-2 h-2 rounded-full bg-state-success" />
          <Metadata>Connected — waiting for prompt</Metadata>
        </div>
      )}

      {/* Active tool executions */}
      {tools.map((tool) => (
        <ToolExecutionIndicator key={tool.id} tool={tool} />
      ))}

      {/* Current streaming message */}
      {currentMessage && currentMessage.textContent.length > 0 && (
        <StreamingMessageBubble message={currentMessage} />
      )}
      {currentMessage && !currentMessage.isComplete && currentMessage.textContent.length === 0 && (
        <ChatBubble role="assistant">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span class="text-text-muted text-sm">
              {currentMessage.thinkingContent.length > 0 ? "Thinking…" : "Starting…"}
            </span>
          </div>
        </ChatBubble>
      )}
    </div>
  );
}
