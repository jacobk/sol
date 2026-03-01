import type { JSX } from "preact";
import { useState, useEffect, useRef, useCallback } from "preact/hooks";
import { ChatBubble, Badge, Metadata, MarkdownRenderer } from "./ui/index.js";
import { StreamingToolDisplay } from "./ToolDisplay.js";

/** Represents a tool execution in progress or completed */
interface ToolExecution {
  id: string;
  toolName: string;
  status: "running" | "done" | "error";
  content?: string;
  /** For bash tools, the command being executed */
  command?: string;
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

/**
 * Individual streaming message renderer.
 * - During streaming: shows plain text (for performance)
 * - When complete: renders markdown
 */
function StreamingMessageBubble({
  message,
}: {
  message: StreamingMessageData;
}): JSX.Element {
  const contentRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

  // Incrementally append only new text to the DOM during streaming
  useEffect(() => {
    // Only do incremental updates while streaming
    if (message.isComplete) return;

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
  }, [message.textContent, message.isComplete]);

  // Reset tracking when message completes (for next message)
  useEffect(() => {
    if (message.isComplete) {
      prevLengthRef.current = 0;
    }
  }, [message.isComplete]);

  return (
    <ChatBubble role="assistant">
      {/* Thinking content - always visible inline (per PRD 3.2) */}
      {message.thinkingContent && (
        <div class="text-sm text-text-muted/60 italic whitespace-pre-wrap break-words mb-2">
          {message.thinkingContent}
        </div>
      )}
      {message.isComplete ? (
        // Render markdown when complete
        <MarkdownRenderer content={message.textContent} />
      ) : (
        // Plain text during streaming for performance
        <div
          ref={contentRef}
          class="whitespace-pre-wrap break-words"
        />
      )}
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
 * Extract bash command from tool call arguments if available.
 */
function extractBashCommand(args: unknown): string | undefined {
  if (typeof args === "object" && args !== null) {
    const a = args as Record<string, unknown>;
    if (typeof a.command === "string") return a.command;
  }
  return undefined;
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
  const [agentStatus, setAgentStatus] = useState<"idle" | "working">("idle");
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
          setAgentStatus("working");
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
          setAgentStatus("idle");
          onStreamingChange(false);
          onNewMessage?.();
          break;

        case "tool_execution_start": {
          const toolId = (data.toolCallId as string) ?? `tool-${Date.now()}`;
          const toolName = (data.toolName as string) ?? "tool";
          const args = data.args as Record<string, unknown> | undefined;
          const command = toolName === "bash" ? extractBashCommand(args) : undefined;
          
          setTools((prev) => [
            ...prev,
            { id: toolId, toolName, status: "running", command },
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
          setAgentStatus("idle");
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
      setAgentStatus("idle");
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

  // Determine if any tool is currently running
  const hasRunningTool = tools.some(t => t.status === "running");

  return (
    <div class="space-y-3">
      {/* Connection status indicator */}
      {connectionStatus === "connecting" && (
        <StatusIndicator status="connecting" message="Connecting to session…" />
      )}
      {connectionStatus === "disconnected" && (
        <StatusIndicator status="error" message="Disconnected. Reconnecting…" />
      )}
      {connectionStatus === "connected" && agentStatus === "idle" && !currentMessage && tools.length === 0 && (
        <StatusIndicator status="ready" message="Ready — send a prompt" />
      )}

      {/* Active tool executions - using shared terminal-style components */}
      {tools.map((tool) => (
        <StreamingToolDisplay
          key={tool.id}
          toolName={tool.toolName}
          status={tool.status}
          content={tool.content}
          command={tool.command}
        />
      ))}

      {/* Current streaming message */}
      {currentMessage && currentMessage.textContent.length > 0 && (
        <StreamingMessageBubble message={currentMessage} />
      )}
      
      {/* Thinking/starting indicator when no text yet */}
      {currentMessage && !currentMessage.isComplete && currentMessage.textContent.length === 0 && !hasRunningTool && (
        <ChatBubble role="assistant">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span class="text-text-muted text-sm">
              {currentMessage.thinkingContent.length > 0 ? "Thinking…" : "Starting…"}
            </span>
          </div>
        </ChatBubble>
      )}

      {/* Agent working indicator - show prominently at bottom when agent is active */}
      {agentStatus === "working" && (
        <div class="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 bg-accent text-on-accent rounded-full px-4 py-2 text-sm font-medium shadow-lg flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-on-accent animate-pulse" />
          Agent working…
        </div>
      )}
    </div>
  );
}

/**
 * Status indicator component for connection/agent state.
 */
function StatusIndicator({ 
  status, 
  message 
}: { 
  status: "connecting" | "ready" | "error"; 
  message: string;
}): JSX.Element {
  const dotColor = {
    connecting: "bg-accent animate-pulse",
    ready: "bg-state-success",
    error: "bg-state-error",
  }[status];

  return (
    <div class="flex items-center gap-2 px-4 py-2">
      <span class={`w-2 h-2 rounded-full ${dotColor}`} />
      <Metadata>{message}</Metadata>
    </div>
  );
}
