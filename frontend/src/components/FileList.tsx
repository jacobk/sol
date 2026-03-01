import type { JSX } from "preact";
import { useState, useEffect } from "preact/hooks";
import { Badge, Body, Container, IconButton, Metadata, Stack, Title } from "./ui/index.js";

export interface GitFileStatus {
  path: string;
  status: "modified" | "added" | "untracked" | "deleted" | "renamed" | "copied";
}

interface FileListProps {
  sessionId: string;
  onBack: () => void;
  onSelectFile: (filePath: string) => void;
  onSelectDiff: (filePath: string) => void;
}

type LoadState = "loading" | "loaded" | "error";

const STATUS_LABELS: Record<string, { label: string; variant: "accent" | "success" | "warning" | "error" }> = {
  modified: { label: "M", variant: "warning" },
  added: { label: "A", variant: "success" },
  untracked: { label: "?", variant: "accent" },
  deleted: { label: "D", variant: "error" },
  renamed: { label: "R", variant: "accent" },
  copied: { label: "C", variant: "accent" },
};

const STATUS_ORDER: string[] = ["modified", "added", "untracked", "deleted", "renamed", "copied"];

function groupByStatus(files: GitFileStatus[]): Map<string, GitFileStatus[]> {
  const groups = new Map<string, GitFileStatus[]>();
  for (const file of files) {
    const list = groups.get(file.status) ?? [];
    list.push(file);
    groups.set(file.status, list);
  }
  return groups;
}

function fileName(filePath: string): string {
  return filePath.split("/").pop() ?? filePath;
}

function fileDir(filePath: string): string {
  const parts = filePath.split("/");
  if (parts.length <= 1) return "";
  return parts.slice(0, -1).join("/") + "/";
}

export function FileList({ sessionId, onBack, onSelectFile, onSelectDiff }: FileListProps): JSX.Element {
  const [files, setFiles] = useState<GitFileStatus[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const fetchFiles = async (): Promise<void> => {
      setLoadState("loading");
      try {
        const res = await fetch(`/api/files/${encodeURIComponent(sessionId)}`);
        if (res.status === 404) {
          setErrorMessage("No git repository found for this session");
          setLoadState("error");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { cwd: string; files: GitFileStatus[] };
        setFiles(data.files);
        setLoadState("loaded");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to load files");
        setLoadState("error");
      }
    };
    void fetchFiles();
  }, [sessionId]);

  const grouped = groupByStatus(files);

  return (
    <div class="min-h-screen bg-bg-app">
      {/* Header */}
      <div class="sticky top-0 z-10 bg-bg-app border-b border-border-subtle">
        <Container class="py-3 flex items-center gap-3">
          <IconButton label="Back" onClick={onBack}>←</IconButton>
          <Title class="truncate flex-1">Files</Title>
          {loadState === "loaded" && (
            <Metadata>{files.length} changed</Metadata>
          )}
        </Container>
      </div>

      <Container class="py-4">
        {loadState === "loading" && (
          <div class="flex justify-center py-16">
            <Metadata>Loading files…</Metadata>
          </div>
        )}

        {loadState === "error" && (
          <div class="bg-state-error/10 text-state-error rounded-lg p-4">
            <Body class="text-state-error">{errorMessage}</Body>
          </div>
        )}

        {loadState === "loaded" && files.length === 0 && (
          <div class="flex justify-center py-16">
            <Metadata>No changed files</Metadata>
          </div>
        )}

        {loadState === "loaded" && files.length > 0 && (
          <Stack direction="vertical" gap={4}>
            {STATUS_ORDER.map((status) => {
              const group = grouped.get(status);
              if (!group || group.length === 0) return null;
              const statusInfo = STATUS_LABELS[status] ?? { label: status, variant: "accent" as const };
              return (
                <div key={status}>
                  <div class="flex items-center gap-2 mb-2 px-1">
                    <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                    <Metadata class="uppercase tracking-wide">{status} ({group.length})</Metadata>
                  </div>
                  <Stack direction="vertical" gap={1}>
                    {group.map((file) => (
                      <div
                        key={file.path}
                        class="bg-surface rounded-lg px-4 py-3 flex items-center gap-3 min-h-[var(--spacing-touch)]"
                      >
                        <button
                          type="button"
                          onClick={() => onSelectFile(file.path)}
                          class="flex-1 text-left active:opacity-70 transition-opacity duration-100 min-h-[var(--spacing-touch)] flex items-center"
                        >
                          <div class="truncate">
                            <span class="text-text-muted text-xs">{fileDir(file.path)}</span>
                            <span class="text-text-primary text-sm font-medium">{fileName(file.path)}</span>
                          </div>
                        </button>
                        {file.status !== "deleted" && file.status !== "untracked" && (
                          <button
                            type="button"
                            onClick={() => onSelectDiff(file.path)}
                            class="text-xs text-accent active:text-accent-hover min-w-[var(--spacing-touch)] min-h-[var(--spacing-touch)] flex items-center justify-center select-none"
                            aria-label={`View diff for ${file.path}`}
                          >
                            Diff
                          </button>
                        )}
                      </div>
                    ))}
                  </Stack>
                </div>
              );
            })}
          </Stack>
        )}
      </Container>
    </div>
  );
}
