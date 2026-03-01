import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { stripAnsi } from "../utils/text.js";

/** Number of output lines to show in preview */
const BASH_PREVIEW_LINES = 5;

/** Preview line counts per tool type */
const TOOL_PREVIEW_LINES: Record<string, number> = {
  read: 10,
  write: 10,
  edit: 50,
  ls: 20,
  find: 20,
  grep: 15,
  webfetch: 10,
  default: 10,
};

/** Tool-specific header parsing from content */
interface ToolHeader {
  title: string;
  subtitle?: string;
}

/**
 * Parse tool result content to extract useful header info.
 */
function parseToolHeader(toolName: string, content: string): ToolHeader {
  const lines = content.split("\n");
  const firstLine = (lines[0] || "").trim();

  switch (toolName) {
    case "bash": {
      if (firstLine) {
        const preview = firstLine.length > 50 ? firstLine.slice(0, 50) + "…" : firstLine;
        return { title: "bash", subtitle: preview };
      }
      return { title: "bash" };
    }
    case "read": {
      const lineCount = lines.length;
      return { title: "read", subtitle: `${lineCount} lines` };
    }
    case "write": {
      const writeMatch = content.match(/(?:wrote|written)\s+\d+\s+bytes\s+to\s+([^\s]+)/i);
      if (writeMatch) return { title: writeMatch[1] };
      const pathMatch = content.match(/(?:to|wrote)\s+([\/\w\-_.]+\.\w+)/i);
      if (pathMatch) return { title: pathMatch[1] };
      return { title: "write" };
    }
    case "edit": {
      const editMatch = content.match(/(?:replaced|edited)\s+(?:text\s+)?in\s+([^\s.]+)/i);
      if (editMatch) return { title: editMatch[1] };
      return { title: "edit" };
    }
    case "ls": {
      const fileCount = lines.filter(l => l.trim()).length;
      return { title: "ls", subtitle: `${fileCount} items` };
    }
    case "find": {
      const resultCount = lines.filter(l => l.trim()).length;
      return { title: "find", subtitle: `${resultCount} results` };
    }
    case "grep": {
      const matchCount = lines.filter(l => l.trim()).length;
      return { title: "grep", subtitle: `${matchCount} matches` };
    }
    case "webfetch": {
      const urlMatch = content.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        const url = urlMatch[1].length > 40 ? urlMatch[1].slice(0, 40) + "…" : urlMatch[1];
        return { title: url };
      }
      return { title: "webfetch" };
    }
    default:
      return { title: toolName };
  }
}

/** Check if content looks like a diff */
function isDiffContent(content: string): boolean {
  const lines = content.split("\n").slice(0, 10);
  return lines.some(line => 
    line.startsWith("+++") || 
    line.startsWith("---") || 
    line.startsWith("@@") ||
    (line.startsWith("+") && !line.startsWith("+++")) ||
    (line.startsWith("-") && !line.startsWith("---"))
  );
}

/** Render diff content with +/- coloring */
function DiffContent({ lines }: { lines: string[] }): JSX.Element {
  return (
    <div class="font-mono overflow-hidden">
      {lines.map((line, i) => {
        let colorClass = "text-text-muted";
        if (line.startsWith("+") && !line.startsWith("+++")) {
          colorClass = "text-state-success";
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          colorClass = "text-state-error";
        } else if (line.startsWith("@@")) {
          colorClass = "text-accent-text";
        }
        return (
          <div key={i} class={`${colorClass} whitespace-pre-wrap break-all`}>
            {line}
          </div>
        );
      })}
    </div>
  );
}

/** Props for streaming tool display (partial data) */
export interface StreamingToolProps {
  toolName: string;
  status: "running" | "done" | "error";
  content?: string;
  command?: string;
}

/** Props for complete bash execution display */
export interface BashExecutionProps {
  command: string;
  output: string;
  exitCode: number | undefined;
  cancelled: boolean;
  truncated: boolean;
}

/** Props for complete tool result display */
export interface ToolResultProps {
  toolName: string;
  content: string;
  isError: boolean;
}

/**
 * Terminal-style bash execution bubble.
 * Used for both streaming and historical messages.
 */
export function BashExecutionBubble({ 
  command, 
  output, 
  exitCode, 
  cancelled,
  isStreaming = false,
}: BashExecutionProps & { isStreaming?: boolean }): JSX.Element {
  const [expanded, setExpanded] = useState(false);

  const cleanOutput = output ? stripAnsi(output) : "";
  const outputLines = cleanOutput ? cleanOutput.split("\n") : [];
  const hasMoreOutput = outputLines.length > BASH_PREVIEW_LINES;
  const previewLines = outputLines.slice(0, BASH_PREVIEW_LINES);
  const hiddenLines = outputLines.length - BASH_PREVIEW_LINES;

  const hasError = exitCode !== undefined && exitCode !== 0;
  const wasCancelled = cancelled;

  return (
    <div class="my-2">
      {/* Command header */}
      <div class="font-mono text-sm bg-surface rounded-t px-3 py-2 overflow-x-auto flex items-center gap-2">
        <span class="text-accent-text font-bold select-none">$ </span>
        <span class="text-text-primary whitespace-pre flex-1">{command}</span>
        {isStreaming && (
          <span class="w-2 h-2 rounded-full bg-accent animate-pulse flex-shrink-0" />
        )}
        {!isStreaming && hasError && (
          <span class="text-state-error text-xs flex-shrink-0">(exit {exitCode})</span>
        )}
        {!isStreaming && wasCancelled && (
          <span class="text-state-warning text-xs flex-shrink-0">(cancelled)</span>
        )}
      </div>

      {/* Output */}
      {cleanOutput && (
        <div class="bg-surface-2 rounded-b border-t border-border-subtle">
          {expanded ? (
            <div class="font-mono text-xs text-text-muted p-3 max-h-96 overflow-auto">
              <pre class="whitespace-pre">{cleanOutput}</pre>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              class="w-full text-left font-mono text-xs text-text-muted p-3 active:bg-border-subtle/50 transition-colors"
            >
              <pre class="whitespace-pre overflow-x-auto">{previewLines.join("\n")}</pre>
              {hasMoreOutput && (
                <div class="text-accent-text mt-1">
                  … {hiddenLines} more lines — tap to expand
                </div>
              )}
            </button>
          )}
          {expanded && hasMoreOutput && (
            <div class="px-3 pb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                class="text-xs text-text-muted active:text-text-primary"
              >
                ▲ collapse
              </button>
            </div>
          )}
        </div>
      )}

      {/* Show streaming indicator when no output yet */}
      {isStreaming && !cleanOutput && (
        <div class="bg-surface-2 rounded-b border-t border-border-subtle px-3 py-2">
          <span class="text-xs text-text-muted">Running…</span>
        </div>
      )}
    </div>
  );
}

/**
 * Terminal-style tool result bubble.
 * Used for both streaming and historical messages.
 */
export function ToolResultBubble({ 
  toolName, 
  content, 
  isError,
  isStreaming = false,
}: ToolResultProps & { isStreaming?: boolean }): JSX.Element {
  const [expanded, setExpanded] = useState(false);

  const textContent = stripAnsi(content);
  const header = parseToolHeader(toolName, textContent);
  const previewLineCount = TOOL_PREVIEW_LINES[toolName] ?? TOOL_PREVIEW_LINES.default;

  const lines = textContent.split("\n");
  const hasMoreLines = lines.length > previewLineCount;
  const displayLines = expanded ? lines : lines.slice(0, previewLineCount);
  const hiddenLines = lines.length - previewLineCount;

  const isDiff = toolName === "edit" || isDiffContent(textContent);
  const displayTitle = header.title !== toolName ? header.title : "";

  return (
    <div class="my-2">
      {/* Header */}
      <div class="font-mono text-sm bg-surface rounded-t px-3 py-2 flex items-center gap-2 flex-wrap overflow-x-auto">
        <span class="text-accent-text font-bold">{toolName}</span>
        {displayTitle && (
          <span class="text-text-primary whitespace-pre">{displayTitle}</span>
        )}
        {header.subtitle && (
          <span class="text-text-muted text-xs">({header.subtitle})</span>
        )}
        {isStreaming && (
          <span class="w-2 h-2 rounded-full bg-accent animate-pulse flex-shrink-0" />
        )}
        {!isStreaming && isError && (
          <span class="text-state-error text-xs">(error)</span>
        )}
      </div>

      {/* Content */}
      {textContent && (
        <div class="bg-surface-2 rounded-b border-t border-border-subtle">
          {expanded ? (
            <div class="font-mono text-xs text-text-muted p-3 max-h-96 overflow-auto">
              {isDiff ? (
                <DiffContent lines={lines} />
              ) : (
                <pre class="whitespace-pre">{textContent}</pre>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              class="w-full text-left font-mono text-xs text-text-muted p-3 active:bg-border-subtle/50 transition-colors"
            >
              {isDiff ? (
                <DiffContent lines={displayLines} />
              ) : (
                <pre class="whitespace-pre overflow-x-auto">{displayLines.join("\n")}</pre>
              )}
              {hasMoreLines && (
                <div class="text-accent-text mt-1">
                  … {hiddenLines} more lines — tap to expand
                </div>
              )}
            </button>
          )}
          {expanded && hasMoreLines && (
            <div class="px-3 pb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setExpanded(false)}
                class="text-xs text-text-muted active:text-text-primary"
              >
                ▲ collapse
              </button>
            </div>
          )}
        </div>
      )}

      {/* Show streaming indicator when no content yet */}
      {isStreaming && !textContent && (
        <div class="bg-surface-2 rounded-b border-t border-border-subtle px-3 py-2">
          <span class="text-xs text-text-muted">Running…</span>
        </div>
      )}
    </div>
  );
}

/**
 * Streaming tool display - converts streaming tool data to terminal style.
 * Shows running indicator, command/tool name, and partial output.
 */
export function StreamingToolDisplay({ 
  toolName, 
  status, 
  content,
  command,
}: StreamingToolProps): JSX.Element {
  const isRunning = status === "running";
  const isError = status === "error";

  // For bash, show as BashExecutionBubble
  if (toolName === "bash") {
    return (
      <BashExecutionBubble
        command={command || "(running)"}
        output={content || ""}
        exitCode={isError ? 1 : undefined}
        cancelled={false}
        truncated={false}
        isStreaming={isRunning}
      />
    );
  }

  // For other tools, show as ToolResultBubble
  return (
    <ToolResultBubble
      toolName={toolName}
      content={content || ""}
      isError={isError}
      isStreaming={isRunning}
    />
  );
}
