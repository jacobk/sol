import type { JSX } from "preact";
import { useState, useEffect, useRef } from "preact/hooks";
import { Body, Button, Container, IconButton, Metadata, Title } from "./ui/index.js";

interface FileViewerProps {
  sessionId: string;
  filePath: string;
  onBack: () => void;
}

type LoadState = "loading" | "loaded" | "error";

function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    rb: "ruby",
    rs: "rust",
    go: "go",
    java: "java",
    kt: "kotlin",
    swift: "swift",
    c: "c",
    cpp: "cpp",
    h: "c",
    hpp: "cpp",
    cs: "csharp",
    css: "css",
    scss: "scss",
    html: "html",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    md: "markdown",
    sh: "shellscript",
    bash: "shellscript",
    zsh: "shellscript",
    sql: "sql",
    xml: "xml",
    dockerfile: "dockerfile",
    makefile: "makefile",
  };
  // Also check full filename for special cases
  const fileName = filePath.split("/").pop()?.toLowerCase() ?? "";
  if (fileName === "dockerfile") return "dockerfile";
  if (fileName === "makefile") return "makefile";
  return map[ext] ?? "text";
}

function isMarkdown(filePath: string): boolean {
  return filePath.toLowerCase().endsWith(".md");
}

/** Lazy-load Shiki and highlight code */
async function highlightCode(code: string, lang: string): Promise<string> {
  const { createHighlighter } = await import("shiki");
  const highlighter = await createHighlighter({
    themes: ["github-dark"],
    langs: [lang === "text" ? "plaintext" : lang],
  });
  const html = highlighter.codeToHtml(code, {
    lang: lang === "text" ? "plaintext" : lang,
    theme: "github-dark",
  });
  highlighter.dispose();
  return html;
}

/** Lazy-load marked and render markdown */
async function renderMarkdown(content: string): Promise<string> {
  const { marked } = await import("marked");
  marked.setOptions({ gfm: true, breaks: true });
  const html = await marked.parse(content);
  return html;
}

export function FileViewer({ sessionId, filePath, onBack }: FileViewerProps): JSX.Element {
  const [content, setContent] = useState("");
  const [highlightedHtml, setHighlightedHtml] = useState("");
  const [markdownHtml, setMarkdownHtml] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [showRaw, setShowRaw] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const isMd = isMarkdown(filePath);
  const lang = getLanguageFromPath(filePath);
  const fileName = filePath.split("/").pop() ?? filePath;

  // Fetch file content
  useEffect(() => {
    const fetchContent = async (): Promise<void> => {
      setLoadState("loading");
      try {
        const res = await fetch(
          `/api/files/${encodeURIComponent(sessionId)}/content?path=${encodeURIComponent(filePath)}`
        );
        if (res.status === 404) {
          setErrorMessage("File not found");
          setLoadState("error");
          return;
        }
        if (res.status === 403) {
          setErrorMessage("Invalid file path");
          setLoadState("error");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { path: string; content: string };
        setContent(data.content);
        setLoadState("loaded");
      } catch (err) {
        setErrorMessage(err instanceof Error ? err.message : "Failed to load file");
        setLoadState("error");
      }
    };
    void fetchContent();
  }, [sessionId, filePath]);

  // Highlight code once content is loaded
  useEffect(() => {
    if (!content || loadState !== "loaded") return;

    if (isMd) {
      // For markdown: render both highlighted raw and rendered markdown
      void renderMarkdown(content).then(setMarkdownHtml).catch(() => {
        setMarkdownHtml(`<pre>${escapeHtml(content)}</pre>`);
      });
      void highlightCode(content, "markdown").then(setHighlightedHtml).catch(() => {
        setHighlightedHtml(`<pre>${escapeHtml(content)}</pre>`);
      });
    } else {
      void highlightCode(content, lang).then(setHighlightedHtml).catch(() => {
        setHighlightedHtml(`<pre>${escapeHtml(content)}</pre>`);
      });
    }
  }, [content, loadState, lang, isMd]);

  return (
    <div class="min-h-screen bg-bg-app">
      {/* Header */}
      <div class="sticky top-0 z-10 bg-bg-app border-b border-border-subtle">
        <Container class="py-3 flex items-center gap-3">
          <IconButton label="Back" onClick={onBack}>←</IconButton>
          <Title class="truncate flex-1">{fileName}</Title>
          {isMd && loadState === "loaded" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowRaw(!showRaw)}
            >
              {showRaw ? "Rendered" : "Raw"}
            </Button>
          )}
        </Container>
        <Container class="pb-2">
          <Metadata class="truncate block">{filePath}</Metadata>
        </Container>
      </div>

      <div class="py-2">
        {loadState === "loading" && (
          <Container>
            <div class="flex justify-center py-16">
              <Metadata>Loading file…</Metadata>
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

        {loadState === "loaded" && (
          <div ref={contentRef}>
            {isMd && !showRaw && markdownHtml ? (
              <Container>
                <div
                  class="markdown-prose"
                  dangerouslySetInnerHTML={{ __html: markdownHtml }}
                />
              </Container>
            ) : (
              <div
                class="overflow-x-auto [&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:px-4 [&_pre]:py-2 [&_code]:text-xs [&_code]:font-mono [&_.line]:whitespace-pre"
                dangerouslySetInnerHTML={{
                  __html: highlightedHtml || `<pre class="px-4 py-2"><code class="text-xs font-mono">${escapeHtml(content)}</code></pre>`,
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
