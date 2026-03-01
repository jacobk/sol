import type { JSX } from "preact";
import { useState, useRef, useCallback, useEffect } from "preact/hooks";
import { IconButton } from "./ui/index.js";
import type { PromptState } from "../hooks/usePromptState.js";
import { MODE_LABELS } from "../hooks/usePromptState.js";

/** Max rows before the textarea scrolls internally */
const MAX_ROWS = 6;

interface PromptInputProps {
  promptState: PromptState;
  isStreaming: boolean;
  onAbort: () => void;
  onExpandComposer: () => void;
  class?: string;
}

/**
 * Compact prompt input bar at the bottom of the session view.
 * Includes expand button to open the full MobileComposer.
 */
export function PromptInput({
  promptState,
  isStreaming,
  onAbort,
  onExpandComposer,
  class: className = "",
}: PromptInputProps): JSX.Element {
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
  }, [promptState.text, resize]);

  const handleSend = useCallback(() => {
    void promptState.sendPrompt();
  }, [promptState]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Enter without shift sends on desktop (not primary use case but nice to have)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!isStreaming && promptState.canSend) {
          handleSend();
        }
      }
    },
    [handleSend, isStreaming, promptState.canSend]
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

  const handleSelectMode = useCallback(
    (newMode: typeof promptState.mode) => {
      promptState.setMode(newMode);
      setShowModeMenu(false);
    },
    [promptState]
  );

  return (
    <div class={`bg-bg-app border-t border-border-subtle pb-[env(safe-area-inset-bottom)] ${className}`}>
      {/* Mode menu (shown on long-press) */}
      {showModeMenu && (
        <div class="flex gap-2 px-4 pt-3 pb-1">
          {(["prompt", "steer", "follow_up"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => handleSelectMode(m)}
              class={`
                px-3 py-1.5 rounded-full text-sm font-medium min-h-[var(--spacing-touch)]
                transition-colors duration-100
                ${
                  m === promptState.mode
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
      {promptState.sendState === "error" && (
        <div class="px-4 pt-2">
          <span class="text-xs text-state-error">Failed to send. Try again.</span>
        </div>
      )}

      {/* Input row */}
      <div class="flex items-end gap-2 px-4 py-3">
        {/* Expand button */}
        <IconButton label="Open full editor" onClick={onExpandComposer} class="shrink-0 mb-0.5">
          <ExpandIcon />
        </IconButton>

        {/* Mode indicator (when not default) */}
        {promptState.mode !== "prompt" && (
          <button
            type="button"
            onClick={() => promptState.setMode("prompt")}
            class="shrink-0 mb-0.5 px-2 py-1 rounded text-xs font-medium bg-accent/20 text-accent min-h-[var(--spacing-touch)] flex items-center"
            aria-label={`Mode: ${MODE_LABELS[promptState.mode]}. Tap to reset.`}
          >
            {MODE_LABELS[promptState.mode]} ✕
          </button>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={promptState.text}
          placeholder={isStreaming ? "Steer the agent…" : "Send a message…"}
          disabled={promptState.sendState === "sending"}
          rows={1}
          onInput={(e) => {
            promptState.setText((e.target as HTMLTextAreaElement).value);
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
            disabled={!promptState.canSend}
            class={`
              shrink-0 w-11 h-11 rounded-full flex items-center justify-center
              transition-all duration-100
              ${
                promptState.canSend
                  ? "bg-accent text-white active:opacity-70"
                  : "bg-surface text-text-muted opacity-40"
              }
              ${promptState.sendState === "sending" ? "animate-pulse" : ""}
            `}
            aria-label={MODE_LABELS[promptState.mode]}
          >
            {promptState.sendState === "sending" ? "…" : "↑"}
          </button>
        )}
      </div>
    </div>
  );
}

/** Expand icon for opening full composer */
function ExpandIcon(): JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}
