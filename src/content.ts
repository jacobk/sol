/**
 * Backend content extraction utility for session entry content blocks.
 * Mirrors the frontend's `frontend/src/utils/content.ts` for server-side use.
 * Used by tree serialization to generate preview text for tree nodes.
 */

/**
 * Extract plain text from content blocks (string, array of blocks, or undefined).
 * Filters to text-type blocks and joins their text content.
 */
export function extractPlainText(
  blocks: unknown[] | string | undefined
): string {
  if (!blocks) return "";
  if (typeof blocks === "string") return blocks;

  const parts: string[] = [];
  for (const block of blocks) {
    if (
      typeof block === "object" &&
      block !== null &&
      "type" in block &&
      (block as { type: string }).type === "text" &&
      "text" in block
    ) {
      parts.push((block as { text: string }).text);
    }
  }
  return parts.join("\n");
}

/**
 * Truncate text to a maximum length, collapsing newlines to spaces.
 * Appends "…" if truncated.
 */
export function truncatePreview(text: string, maxLength = 120): string {
  const clean = text.replace(/\n/g, " ").trim();
  if (clean.length <= maxLength) return clean;
  return clean.slice(0, maxLength).trimEnd() + "…";
}
