import type { JSX } from "preact";
import { useState, useRef, useCallback, useEffect } from "preact/hooks";

/** Delivery mode for the prompt */
export type DeliveryMode = "prompt" | "steer" | "follow_up";

type SendState = "idle" | "sending" | "error";

interface PromptInputProps {
  sessionId: string;
  isStreaming: boolean;
  onAbort: () => void;
  onPromptSent?: () => void;
  class?: string;
}

/** Max rows before the textarea scrolls internally */
const MAX_ROWS = 6;

/** Labels for each delivery mode */
const MODE_LABELS: Record<DeliveryMode, string> = {
  prompt: "Send",
  steer: "Steer",
  follow_up: "Follow Up",
};

export function PromptInput({
  sessionId,
  isStreaming,
  onAbort,
  onPromptSent,
  class: className = "",
}: PromptInputProps): JSX.Element {
  const [text, setText] = useState("");
  const [sendState, setSendState] = useState<SendState>("idle");
  const [mode, setMode] = useState<DeliveryMode>("prompt");
  const [showModeMenu, setShowModeMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-resize the textarea
  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseInt(getComputedStyle(el).lineHeight) || 20;
    const maxHeight = lineHeight * MAX_ROWS;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, []);

  useEffect(() => {
    resize();
  }, [text, resize]);

  const sendPrompt = useCallback(async (deliveryMode: DeliveryMode) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setSendState("sending");
    try {
      const endpoint = `/api/session/${encodeURIComponent(sessionId)}/${deliveryMode}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" })) as { error: string };
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      setText("");
      setSendState("idle");
      onPromptSent?.();
      // Reset mode to prompt after sending
      if (deliveryMode !== "prompt") {
        setMode("prompt");
      }
    } catch (err) {
      console.error("Failed to send prompt:", err);
      setSendState("error");
      // Clear error state after 2 seconds
      setTimeout(() => setSendState("idle"), 2000);
    }
  }, [text, sessionId]);

  const handleSend = useCallback(() => {
    void sendPrompt(mode);
  }, [sendPrompt, mode]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Enter without shift sends on desktop (not primary use case but nice to have)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!isStreaming && text.trim()) {
          handleSend();
        }
      }
    },
    [handleSend, isStreaming, text]
  );

  // Long press on send button to open mode selector
  const handleSendTouchStart = useCallback(() => {
    longPressTimerRef.current = setTimeout(() => {
      setShowModeMenu(true);
      longPressTimerRef.current = null;
    }, 500);
  }, []);

  const handleSendTouchEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
      // Short press — just send
      if (!showModeMenu) {
        handleSend();
      }
    }
  }, [handleSend, showModeMenu]);

  const handleSelectMode = useCallback((newMode: DeliveryMode) => {
    setMode(newMode);
    setShowModeMenu(false);
  }, []);

  const canSend = text.trim().length > 0 && sendState !== "sending";

  return (
    <div class={`bg-bg-app border-t border-border-subtle ${className}`}>
      {/* Mode menu (shown on long-press) */}
      {showModeMenu && (
        <div class="flex gap-2 px-4 pt-3 pb-1">
          {(["prompt", "steer", "follow_up"] as DeliveryMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => handleSelectMode(m)}
              class={`
                px-3 py-1.5 rounded-full text-sm font-medium min-h-[var(--spacing-touch)]
                transition-colors duration-100
                ${m === mode
                  ? "bg-accent text-white"
                  : "bg-surface text-text-muted active:bg-surface-2"
                }
              `}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
      )}

      {/* Error feedback */}
      {sendState === "error" && (
        <div class="px-4 pt-2">
          <span class="text-xs text-state-error">Failed to send. Try again.</span>
        </div>
      )}

      {/* Input row */}
      <div class="flex items-end gap-2 px-4 py-3">
        {/* Mode indicator (when not default) */}
        {mode !== "prompt" && (
          <button
            type="button"
            onClick={() => setMode("prompt")}
            class="shrink-0 mb-0.5 px-2 py-1 rounded text-xs font-medium bg-accent/20 text-accent min-h-[var(--spacing-touch)] flex items-center"
            aria-label={`Mode: ${MODE_LABELS[mode]}. Tap to reset.`}
          >
            {MODE_LABELS[mode]} ✕
          </button>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          placeholder={isStreaming ? "Steer the agent…" : "Send a message…"}
          disabled={sendState === "sending"}
          rows={1}
          onInput={(e) => {
            setText((e.target as HTMLTextAreaElement).value);
            resize();
          }}
          onKeyDown={handleKeyDown}
          class="
            flex-1 min-h-[var(--spacing-touch)] px-3 py-2.5 rounded-lg resize-none
            bg-surface text-text-primary placeholder:text-text-muted
            border border-border-subtle
            focus:outline-none focus:border-accent
            disabled:opacity-40
            text-base leading-relaxed
          "
        />

        {/* Send / Abort button */}
        {isStreaming ? (
          <button
            type="button"
            onClick={onAbort}
            class="
              shrink-0 w-11 h-11 rounded-full flex items-center justify-center
              bg-state-error text-white
              active:opacity-70 transition-opacity duration-100
            "
            aria-label="Abort"
          >
            ■
          </button>
        ) : (
          <button
            type="button"
            onTouchStart={handleSendTouchStart}
            onTouchEnd={handleSendTouchEnd}
            onTouchCancel={() => {
              if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
              }
            }}
            onClick={(e) => {
              // Only handle click for non-touch (mouse) interactions
              if (e.detail > 0 && !("ontouchstart" in window)) {
                handleSend();
              }
            }}
            disabled={!canSend}
            class={`
              shrink-0 w-11 h-11 rounded-full flex items-center justify-center
              transition-all duration-100
              ${canSend
                ? "bg-accent text-white active:opacity-70"
                : "bg-surface text-text-muted opacity-40"
              }
              ${sendState === "sending" ? "animate-pulse" : ""}
            `}
            aria-label={MODE_LABELS[mode]}
          >
            {sendState === "sending" ? "…" : "↑"}
          </button>
        )}
      </div>
    </div>
  );
}
