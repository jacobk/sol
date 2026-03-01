import type { JSX } from "preact";
import { useState, useEffect } from "preact/hooks";
import { Body, Container, IconButton, Metadata, Title } from "./ui/index.js";

interface DiffViewerProps {
  sessionId: string;
  filePath: string;
  onBack: () => void;
}

type LoadState = "loading" | "loaded" | "error";

/** Lazy-load diff2html and render diff */
async function renderDiff(diffText: string): Promise<string> {
  const { html } = await import("diff2html");
  return html(diffText, {
    drawFileList: false,
    matching: "lines",
    outputFormat: "line-by-line",
  });
}

export function DiffViewer({ sessionId, filePath, onBack }: DiffViewerProps): JSX.Element {
  const [diffHtml, setDiffHtml] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [rawDiff, setRawDiff] = useState("");

  const fileName = filePath.split("/").pop() ?? filePath;

  useEffect(() => {
    const fetchDiff = async (): Promise<void> => {
      setLoadState("loading");
      try {
        const res = await fetch(
          `/api/files/${encodeURIComponent(sessionId)}/diff?path=${encodeURIComponent(filePath)}`
        );
        if (res.status === 404) {
          setErrorMessage("No diff available");
          setLoadState("error");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { path: string; diff: string };
        setRawDiff(data.diff);

        if (!data.diff.trim()) {
          setDiffHtml("");
          setLoadState("loaded");
          return;
        }

        const html = await renderDiff(data.diff);
        setDiffHtml(html);
        setLoadState("loaded");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to load diff");
        setLoadState("error");
      }
    };
    void fetchDiff();
  }, [sessionId, filePath]);

  return (
    <div class="min-h-screen bg-bg-app">
      {/* Header */}
      <div class="sticky top-0 z-10 bg-bg-app border-b border-border-subtle">
        <Container class="py-3 flex items-center gap-3">
          <IconButton label="Back" onClick={onBack}>←</IconButton>
          <Title class="truncate flex-1">Diff: {fileName}</Title>
        </Container>
        <Container class="pb-2">
          <Metadata class="truncate block">{filePath}</Metadata>
        </Container>
      </div>

      <div class="py-2">
        {loadState === "loading" && (
          <Container>
            <div class="flex justify-center py-16">
              <Metadata>Loading diff…</Metadata>
            </div>
          </Container>
        )}

        {loadState === "error" && (
          <Container>
            <div class="bg-state-error/10 text-state-error rounded-lg p-4">
              <Body class="text-state-error">{errorMessage}</Body>
            </div>
          </Container>
        )}

        {loadState === "loaded" && !rawDiff.trim() && (
          <Container>
            <div class="flex justify-center py-16">
              <Metadata>No changes to display</Metadata>
            </div>
          </Container>
        )}

        {loadState === "loaded" && diffHtml && (
          <div
            class="diff-viewer overflow-x-auto [&_.d2h-wrapper]:bg-transparent
              [&_.d2h-file-header]:bg-surface [&_.d2h-file-header]:text-text-primary [&_.d2h-file-header]:border-border-subtle
              [&_.d2h-code-linenumber]:bg-surface [&_.d2h-code-linenumber]:text-text-muted [&_.d2h-code-linenumber]:border-border-subtle
              [&_.d2h-code-line]:bg-transparent [&_.d2h-code-line]:text-text-primary
              [&_.d2h-del]:bg-state-error/15 [&_.d2h-del_.d2h-code-line-ctn]:text-state-error
              [&_.d2h-ins]:bg-state-success/15 [&_.d2h-ins_.d2h-code-line-ctn]:text-state-success
              [&_.d2h-info]:bg-surface-2 [&_.d2h-info]:text-text-muted
              [&_.d2h-code-line-ctn]:text-xs [&_.d2h-code-line-ctn]:font-mono
              [&_.d2h-file-diff]:border-border-subtle
              [&_table]:w-full [&_td]:text-xs [&_td]:font-mono"
            dangerouslySetInnerHTML={{ __html: diffHtml }}
          />
        )}
      </div>

      {/* Import diff2html CSS */}
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/npm/diff2html/bundles/css/diff2html.min.css"
      />
    </div>
  );
}
