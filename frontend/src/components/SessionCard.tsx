import type { JSX } from "preact";
import { Badge, Body, Metadata, Stack } from "./ui/index.js";
import { formatRelativeTime, truncate } from "../utils/format.js";

export interface SessionResponse {
  path: string;
  id: string;
  cwd: string;
  name?: string;
  created: string;
  modified: string;
  messageCount: number;
  firstMessage: string;
}

interface SessionCardProps {
  session: SessionResponse;
  onSelect: () => void;
  /** Optional extra badge (e.g. hit count) */
  extraBadge?: JSX.Element;
}

export function SessionCard({ session, onSelect, extraBadge }: SessionCardProps): JSX.Element {
  const displayName = session.name || truncate(session.firstMessage, 80) || "Empty session";

  return (
    <button
      type="button"
      class="w-full text-left bg-surface rounded-lg p-4 active:bg-surface-2 transition-colors duration-100 min-h-[var(--spacing-touch)]"
      onClick={onSelect}
    >
      <Stack direction="vertical" gap={2}>
        <Body class="line-clamp-2">{displayName}</Body>
        <Stack direction="horizontal" gap={3} class="items-center">
          <Badge>{session.messageCount} msgs</Badge>
          {extraBadge}
          <Metadata>{formatRelativeTime(session.modified)}</Metadata>
        </Stack>
      </Stack>
    </button>
  );
}
