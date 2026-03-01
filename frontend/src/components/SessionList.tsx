import type { JSX } from "preact";
import { useState, useEffect, useCallback } from "preact/hooks";
import { Body, Button, Container, Metadata, Stack, Title } from "./ui/index.js";
import { SessionCard, type SessionResponse } from "./SessionCard.js";

interface GroupedSessions {
  project: string;
  sessions: SessionResponse[];
}

type LoadState = "idle" | "loading" | "error";

function projectDisplayName(project: string): string {
  // Show just the last directory name for brevity
  const parts = project.split("/").filter(Boolean);
  return parts[parts.length - 1] || project;
}

interface SessionListProps {
  onSelectSession: (id: string) => void;
  onOpenSearch: () => void;
}

function EmptyState(): JSX.Element {
  return (
    <div class="flex flex-col items-center justify-center py-16 px-4">
      <div class="text-4xl mb-4">📭</div>
      <Title class="mb-2 text-center">No sessions found</Title>
      <Metadata class="text-center">
        Start a pi session from your terminal and it will appear here.
      </Metadata>
    </div>
  );
}

export function SessionList({ onSelectSession, onOpenSearch }: SessionListProps): JSX.Element {
  const [groups, setGroups] = useState<GroupedSessions[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const fetchSessions = useCallback(async () => {
    setLoadState("loading");
    setErrorMessage("");
    try {
      const res = await fetch("/api/sessions");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: GroupedSessions[] = await res.json();
      setGroups(data);
      setLoadState("idle");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  return (
    <div class="min-h-screen bg-bg-app">
      {/* Header */}
      <div class="sticky top-0 z-10 bg-bg-app border-b border-border-subtle">
        <Container class="py-3 flex items-center justify-between">
          <Title>Sessions</Title>
          <div class="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenSearch}
            >
              🔍 Search
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void fetchSessions()}
              loading={loadState === "loading"}
            >
              Refresh
            </Button>
          </div>
        </Container>
      </div>

      {/* Content */}
      <Container class="py-4">
        {loadState === "error" && (
          <div class="bg-state-error/10 text-state-error rounded-lg p-4 mb-4">
            <Body class="text-state-error">Failed to load sessions: {errorMessage}</Body>
            <Button
              variant="secondary"
              size="sm"
              class="mt-2"
              onClick={() => void fetchSessions()}
            >
              Retry
            </Button>
          </div>
        )}

        {loadState !== "error" && groups.length === 0 && loadState !== "loading" && (
          <EmptyState />
        )}

        <Stack direction="vertical" gap={6}>
          {groups.map((group) => (
            <div key={group.project}>
              <Metadata class="block mb-2 px-1 uppercase tracking-wide text-xs font-semibold">
                {projectDisplayName(group.project)}
              </Metadata>
              <Stack direction="vertical" gap={2}>
                {group.sessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    onSelect={() => onSelectSession(session.id)}
                  />
                ))}
              </Stack>
            </div>
          ))}
        </Stack>
      </Container>
    </div>
  );
}
