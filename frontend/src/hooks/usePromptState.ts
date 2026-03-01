import { useState, useCallback } from "preact/hooks";

/** Delivery mode for the prompt */
export type DeliveryMode = "prompt" | "steer" | "follow_up";

type SendState = "idle" | "sending" | "error";

/** Labels for each delivery mode */
export const MODE_LABELS: Record<DeliveryMode, string> = {
  prompt: "Send",
  steer: "Steer",
  follow_up: "Follow Up",
};

export interface PromptState {
  /** Current text content */
  text: string;
  /** Update text content */
  setText: (text: string) => void;
  /** Current delivery mode */
  mode: DeliveryMode;
  /** Update delivery mode */
  setMode: (mode: DeliveryMode) => void;
  /** Current send state */
  sendState: SendState;
  /** Whether the prompt can be sent */
  canSend: boolean;
  /** Send the current prompt */
  sendPrompt: (deliveryMode?: DeliveryMode) => Promise<void>;
  /** Clear the prompt text */
  clear: () => void;
}

interface UsePromptStateOptions {
  sessionId: string;
  onPromptSent?: () => void;
}

/**
 * Shared state hook for prompt text and delivery mode.
 * Used by both PromptInput and MobileComposer to ensure consistent behavior.
 */
export function usePromptState({
  sessionId,
  onPromptSent,
}: UsePromptStateOptions): PromptState {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<DeliveryMode>("prompt");
  const [sendState, setSendState] = useState<SendState>("idle");

  const canSend = text.trim().length > 0 && sendState !== "sending";

  const sendPrompt = useCallback(
    async (deliveryMode?: DeliveryMode) => {
      const useMode = deliveryMode ?? mode;
      const trimmed = text.trim();
      if (!trimmed) return;

      setSendState("sending");
      try {
        const endpoint = `/api/session/${encodeURIComponent(sessionId)}/${useMode}`;

        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        });

        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: "Unknown error" }))) as {
            error: string;
          };
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        setText("");
        setSendState("idle");
        onPromptSent?.();
        // Reset mode to prompt after sending
        if (useMode !== "prompt") {
          setMode("prompt");
        }
      } catch (err) {
        console.error("Failed to send prompt:", err);
        setSendState("error");
        // Clear error state after 2 seconds
        setTimeout(() => setSendState("idle"), 2000);
      }
    },
    [text, mode, sessionId, onPromptSent]
  );

  const clear = useCallback(() => {
    setText("");
    setMode("prompt");
  }, []);

  return {
    text,
    setText,
    mode,
    setMode,
    sendState,
    canSend,
    sendPrompt,
    clear,
  };
}
