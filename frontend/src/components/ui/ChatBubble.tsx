import type { ComponentChildren, JSX } from "preact";

type ChatRole = "user" | "assistant" | "tool" | "tool-result" | "system";

interface ChatBubbleProps {
  role: ChatRole;
  /** Custom label to display (only shown if provided) */
  label?: string;
  /** Content to render inside the bubble */
  children: ComponentChildren;
  /** Additional CSS classes */
  class?: string;
}

/**
 * Message container with terminal-style aesthetic.
 *
 * Design philosophy (matching pi CLI):
 * - NO labels by default — conversation flow is self-evident
 * - User messages: subtle background tint to distinguish
 * - Agent messages: no background, text flows naturally
 * - System messages: subtle left accent
 * - Labels only shown when explicitly provided (for special cases)
 */
export function ChatBubble({
  role,
  label,
  children,
  class: className = "",
}: ChatBubbleProps): JSX.Element {
  // User messages get subtle tint and indent
  const isUser = role === "user";
  const isSystem = role === "system" || role === "tool" || role === "tool-result";
  
  const containerClasses = [
    "py-2",
    // User: subtle background, slight indent
    isUser ? "px-3 ml-4 bg-surface/50 rounded-md" : "px-1",
    // System: subtle left border
    isSystem ? "border-l border-l-role-system/30 pl-3" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div class={containerClasses}>
      {/* Only show label if explicitly provided */}
      {label && (
        <span class="text-[10px] font-medium text-text-muted/60 uppercase tracking-wider mb-1 block">
          {label}
        </span>
      )}
      <div class="text-[15px] leading-relaxed text-text-primary">
        {children}
      </div>
    </div>
  );
}
