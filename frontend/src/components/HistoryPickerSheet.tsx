import type { JSX } from "preact";
import { useMemo } from "preact/hooks";
import { BottomSheet, SearchableList } from "./ui/index.js";
import type { SearchableListItem } from "./ui/index.js";

export interface HistoryMessage {
  id: string;
  text: string;
  timestamp: number;
}

interface HistoryPickerSheetProps {
  open: boolean;
  onClose: () => void;
  messages: HistoryMessage[];
  onSelect: (text: string) => void;
}

/**
 * Bottom sheet for recalling previous user messages.
 * Messages are passed in from the session state (no fetch needed).
 */
export function HistoryPickerSheet({
  open,
  onClose,
  messages,
  onSelect,
}: HistoryPickerSheetProps): JSX.Element {
  // Convert messages to SearchableListItem format, most recent first
  const items: SearchableListItem[] = useMemo(() => {
    // Sort by timestamp descending (most recent first)
    const sorted = [...messages].sort((a, b) => b.timestamp - a.timestamp);

    return sorted.map((msg) => {
      // Format timestamp for display
      const date = new Date(msg.timestamp);
      const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const dateStr = date.toLocaleDateString([], { month: "short", day: "numeric" });

      // Truncate long messages for preview
      const preview =
        msg.text.length > 100 ? msg.text.slice(0, 100).trimEnd() + "…" : msg.text;

      return {
        id: msg.id,
        label: preview,
        secondary: `${dateStr} ${timeStr}`,
      };
    });
  }, [messages]);

  const handleSelect = (item: SearchableListItem): void => {
    // Find the original message and insert its full text
    const msg = messages.find((m) => m.id === item.id);
    if (msg) {
      onSelect(msg.text);
    }
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="History">
      <SearchableList
        items={items}
        onSelect={handleSelect}
        placeholder="Search previous messages…"
        emptyMessage="No previous messages"
      />
    </BottomSheet>
  );
}
