import type { JSX } from "preact";
import { useState, useEffect, useMemo } from "preact/hooks";
import { BottomSheet, SearchableList, Metadata } from "./ui/index.js";
import type { SearchableListItem } from "./ui/index.js";

interface FilePickerSheetProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  onSelect: (filePath: string) => void;
}

/** Response from /api/files/:id/tree */
interface FilesTreeResponse {
  cwd: string;
  files: string[];
}

type LoadState = "idle" | "loading" | "error";

/**
 * Bottom sheet for browsing and selecting project files.
 * Fetches from `/api/files/:id/tree` which returns git-tracked files.
 */
export function FilePickerSheet({
  open,
  onClose,
  sessionId,
  onSelect,
}: FilePickerSheetProps): JSX.Element {
  const [files, setFiles] = useState<string[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [loadedForSession, setLoadedForSession] = useState<string | null>(null);

  // Reset cache when session changes
  useEffect(() => {
    if (loadedForSession !== null && loadedForSession !== sessionId) {
      setFiles([]);
      setLoadedForSession(null);
      setLoadState("idle");
    }
  }, [sessionId, loadedForSession]);

  // Fetch files when sheet opens
  useEffect(() => {
    if (!open) return;
    if (loadedForSession === sessionId) return; // Already loaded for this session

    const fetchFiles = async (): Promise<void> => {
      setLoadState("loading");
      setErrorMessage("");

      try {
        const res = await fetch(`/api/files/${encodeURIComponent(sessionId)}/tree`);
        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: "Unknown error" }))) as {
            error: string;
          };
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const data = (await res.json()) as FilesTreeResponse;
        setFiles(data.files);
        setLoadedForSession(sessionId);
        setLoadState("idle");
      } catch (err) {
        console.error("Failed to fetch files:", err);
        setErrorMessage(err instanceof Error ? err.message : "Unknown error");
        setLoadState("error");
      }
    };

    void fetchFiles();
  }, [open, sessionId, loadedForSession]);

  // Convert files to SearchableListItem format
  const items: SearchableListItem[] = useMemo(() => {
    return files.map((filePath) => {
      // Extract filename and directory for display
      const parts = filePath.split("/");
      const filename = parts.pop() || filePath;
      const directory = parts.length > 0 ? parts.join("/") : "";

      return {
        id: filePath,
        label: filename,
        secondary: directory || undefined,
      };
    });
  }, [files]);

  const handleSelect = (item: SearchableListItem): void => {
    // Insert file path with @ prefix for consistency with pi CLI
    onSelect(`@${item.id}`);
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Files">
      {loadState === "loading" && (
        <div class="py-8 text-center">
          <Metadata>Loading files…</Metadata>
        </div>
      )}

      {loadState === "error" && (
        <div class="py-8 text-center">
          <Metadata class="text-state-error">{errorMessage}</Metadata>
        </div>
      )}

      {loadState === "idle" && (
        <SearchableList
          items={items}
          onSelect={handleSelect}
          placeholder="Search files…"
          emptyMessage="No files found"
        />
      )}
    </BottomSheet>
  );
}
