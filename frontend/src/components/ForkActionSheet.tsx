import type { JSX } from "preact";
import { useCallback } from "preact/hooks";
import { BottomSheet, Button, Body } from "./ui/index.js";

interface ForkActionSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Called when the sheet should close */
  onClose: () => void;
  /** Entry ID to fork from */
  entryId: string;
  /** Called when user confirms the fork */
  onFork: () => void;
  /** Whether a fork operation is in progress */
  loading?: boolean;
}

/**
 * ForkActionSheet - Bottom sheet to confirm forking from an entry.
 *
 * Forking creates a new branch point at the selected message,
 * allowing the user to continue the conversation in a different direction.
 * The session "rewinds" to the fork point.
 *
 * Note: Pi's RPC fork command does not support summarization options.
 * Fork always preserves the full context up to the fork point.
 */
export function ForkActionSheet({
  open,
  onClose,
  entryId,
  onFork,
  loading = false,
}: ForkActionSheetProps): JSX.Element {
  const handleFork = useCallback(() => {
    onFork();
  }, [onFork]);

  return (
    <BottomSheet open={open} onClose={onClose} title="Fork Session">
      <div class="flex flex-col gap-3">
        <Body class="text-text-muted mb-2">
          Create a new branch from this message. The conversation will rewind to this point,
          and you can continue in a different direction.
        </Body>

        <Button
          variant="primary"
          class="w-full"
          onClick={handleFork}
          disabled={loading}
          loading={loading}
        >
          Fork from this message
        </Button>

        <Button
          variant="ghost"
          class="w-full"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </BottomSheet>
  );
}
