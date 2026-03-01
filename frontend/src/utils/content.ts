/**
 * Content extraction utility for session entry content blocks.
 * Extracts display text from all content block types for rendering in chat views.
 * Reusable by search highlighting (TICKET-007) and tree previews (TICKET-006).
 */

interface TextBlock {
  type: "text";
  text: string;
}

interface ThinkingBlock {
  type: "thinking";
  thinking: string;
  redacted?: boolean;
}

interface ToolCallBlock {
  type: "toolCall";
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface ImageBlock {
  type: "image";
  data: string;
  mimeType: string;
}

export type ContentBlock = TextBlock | ThinkingBlock | ToolCallBlock | ImageBlock;

export interface ExtractedContent {
  type: "text" | "thinking" | "toolCall" | "image";
  text: string;
  /** For thinking blocks — whether content was redacted */
  redacted?: boolean;
  /** For toolCall blocks — tool name */
  toolName?: string;
  /** For toolCall blocks — summarized arguments */
  toolArgs?: string;
}

/**
 * Extract display text from a single content block.
 */
export function extractContentBlock(block: ContentBlock): ExtractedContent {
  switch (block.type) {
    case "text":
      return { type: "text", text: block.text };

    case "thinking":
      return {
        type: "thinking",
        text: block.redacted ? "[Thinking redacted]" : block.thinking,
        redacted: block.redacted,
      };

    case "toolCall":
      return {
        type: "toolCall",
        text: `${block.name}(${summarizeArgs(block.arguments)})`,
        toolName: block.name,
        toolArgs: summarizeArgs(block.arguments),
      };

    case "image":
      return {
        type: "image",
        text: `[Image: ${block.mimeType}]`,
      };

    default:
      return { type: "text", text: "[Unknown content]" };
  }
}

/**
 * Extract display text from an array of content blocks.
 */
export function extractAllContent(
  blocks: ContentBlock[] | string | undefined
): ExtractedContent[] {
  if (!blocks) {
    return [];
  }

  if (typeof blocks === "string") {
    return [{ type: "text", text: blocks }];
  }

  return blocks.map(extractContentBlock);
}

/**
 * Extract plain text only from content blocks (for search/previews).
 */
export function extractPlainText(
  blocks: ContentBlock[] | string | undefined
): string {
  if (!blocks) {
    return "";
  }

  if (typeof blocks === "string") {
    return blocks;
  }

  return blocks
    .filter((b): b is TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

/**
 * Summarize tool call arguments for display.
 * Shows first 120 chars of stringified args.
 */
function summarizeArgs(args: Record<string, unknown>): string {
  const keys = Object.keys(args);
  if (keys.length === 0) {
    return "";
  }

  // For single-arg calls, show just the value preview
  if (keys.length === 1) {
    const val = String(args[keys[0]]);
    return val.length > 120 ? val.slice(0, 120) + "…" : val;
  }

  // For multi-arg, show key=value pairs
  const parts = keys.map((k) => {
    const val = String(args[k]);
    const short = val.length > 60 ? val.slice(0, 60) + "…" : val;
    return `${k}: ${short}`;
  });

  const joined = parts.join(", ");
  return joined.length > 120 ? joined.slice(0, 120) + "…" : joined;
}
