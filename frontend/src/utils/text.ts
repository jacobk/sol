/**
 * Text processing utilities for terminal output.
 */

/**
 * Strip ANSI escape sequences from text.
 * 
 * ANSI codes are used for terminal colors/formatting but should not
 * be displayed in the web UI. This regex matches:
 * - CSI sequences: ESC [ ... final_byte
 * - OSC sequences: ESC ] ... ST
 * - Simple escape sequences: ESC followed by single char
 */
export function stripAnsi(text: string): string {
  // Comprehensive ANSI escape sequence pattern
  // eslint-disable-next-line no-control-regex
  const ansiPattern = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~]|\](?:[^\x07\x1B]*(?:\x07|\x1B\\))?)/g;
  return text.replace(ansiPattern, "");
}

/**
 * Truncate text to a maximum number of lines, returning the lines and whether truncated.
 */
export function truncateLines(
  text: string,
  maxLines: number
): { lines: string[]; truncated: boolean; totalLines: number } {
  const allLines = text.split("\n");
  const truncated = allLines.length > maxLines;
  return {
    lines: truncated ? allLines.slice(0, maxLines) : allLines,
    truncated,
    totalLines: allLines.length,
  };
}
