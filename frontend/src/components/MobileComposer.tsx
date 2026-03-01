import type { JSX } from "preact";
import { useState, useRef, useCallback, useEffect } from "preact/hooks";
import { FullScreenOverlay, Button } from "./ui/index.js";
import { ComposerToolbar } from "./ComposerToolbar.js";
import { TemplatePickerSheet } from "./TemplatePickerSheet.js";
import { FilePickerSheet } from "./FilePickerSheet.js";
import { HistoryPickerSheet, type HistoryMessage } from "./HistoryPickerSheet.js";
import type { PromptState } from "../hooks/usePromptState.js";
import { MODE_LABELS } from "../hooks/usePromptState.js";

interface MobileComposerProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  promptState: PromptState;
  historyMessages: HistoryMessage[];
  isStreaming: boolean;
}

/**
 * Full-screen prompt editor with toolbar and picker sheets.
 * Provides an enhanced mobile editing experience.
 */
export function MobileComposer({
  open,
  onClose,
  sessionId,
  promptState,
  historyMessages,
  isStreaming,
}: MobileComposerProps): JSX.Element {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showFiles, setShowFiles] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Focus textarea when composer opens
  useEffect(() => {
    if (open && textareaRef.current) {
      // Small delay to ensure overlay is rendered
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    }
  }, [open]);

  // Insert text at cursor position
  const insertAtCursor = useCallback(
    (insertion: string) => {
      const textarea = textareaRef.current;
      if (!textarea) {
        // Fallback: append to end
        promptState.setText(promptState.text + insertion);
        return;
      }

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = promptState.text.slice(0, start);
      const after = promptState.text.slice(end);

      promptState.setText(before + insertion + after);

      // Move cursor to end of insertion
      const newPosition = start + insertion.length;
      // Need to set cursor after React updates
      setTimeout(() => {
        textarea.setSelectionRange(newPosition, newPosition);
        textarea.focus();
      }, 0);
    },
    [promptState]
  );

  // Replace entire text (for history recall)
  const replaceText = useCallback(
    (newText: string) => {
      promptState.setText(newText);
      // Focus and move cursor to end
      setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          textarea.focus();
          textarea.setSelectionRange(newText.length, newText.length);
        }
      }, 0);
    },
    [promptState]
  );

  const handleSend = useCallback(async () => {
    await promptState.sendPrompt();
    onClose();
  }, [promptState, onClose]);

  const handleClose = useCallback(() => {
    // Text is preserved in promptState, just close the overlay
    onClose();
  }, [onClose]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Cmd/Ctrl+Enter sends
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (promptState.canSend && !isStreaming) {
          void handleSend();
        }
      }
    },
    [promptState.canSend, isStreaming, handleSend]
  );

  return (
    <>
      <FullScreenOverlay open={open} onClose={handleClose}>
        {/* Toolbar */}
        <ComposerToolbar
          onTemplates={() => setShowTemplates(true)}
          onFiles={() => setShowFiles(true)}
          onHistory={() => setShowHistory(true)}
          onClose={handleClose}
        />

        {/* Main editing area */}
        <div class="flex-1 flex flex-col p-4 overflow-hidden">
          <textarea
            ref={textareaRef}
            value={promptState.text}
            placeholder={isStreaming ? "Steer the agent…" : "Compose your message…"}
            disabled={promptState.sendState === "sending"}
            onInput={(e) => promptState.setText((e.target as HTMLTextAreaElement).value)}
            onKeyDown={handleKeyDown}
            class="
              flex-1 w-full p-3 rounded-lg resize-none
              bg-surface text-text-primary placeholder:text-text-muted
              border border-border-subtle
              focus:outline-none focus:border-accent
              disabled:opacity-40
              text-base leading-relaxed
            "
          />
        </div>

        {/* Bottom bar with mode and send */}
        <div class="flex items-center justify-between gap-3 px-4 py-3 border-t border-border-subtle bg-bg-app">
          {/* Mode selector */}
          <div class="flex gap-2">
            {(["prompt", "steer", "follow_up"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => promptState.setMode(m)}
                class={`
                  px-3 py-1.5 rounded-full text-sm font-medium
                  min-h-[var(--spacing-touch)] flex items-center
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

          {/* Send button */}
          <Button
            variant="primary"
            disabled={!promptState.canSend || isStreaming}
            loading={promptState.sendState === "sending"}
            onClick={() => void handleSend()}
          >
            {MODE_LABELS[promptState.mode]}
          </Button>
        </div>

        {/* Error feedback */}
        {promptState.sendState === "error" && (
          <div class="px-4 pb-2">
            <span class="text-xs text-state-error">Failed to send. Try again.</span>
          </div>
        )}
      </FullScreenOverlay>

      {/* Picker sheets */}
      <TemplatePickerSheet
        open={showTemplates}
        onClose={() => setShowTemplates(false)}
        sessionId={sessionId}
        onSelect={insertAtCursor}
      />

      <FilePickerSheet
        open={showFiles}
        onClose={() => setShowFiles(false)}
        sessionId={sessionId}
        onSelect={insertAtCursor}
      />

      <HistoryPickerSheet
        open={showHistory}
        onClose={() => setShowHistory(false)}
        messages={historyMessages}
        onSelect={replaceText}
      />
    </>
  );
}
