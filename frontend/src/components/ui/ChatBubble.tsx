import type { ComponentChildren, JSX } from "preact";

type ChatRole = "user" | "assistant" | "tool" | "tool-result" | "system";

interface ChatBubbleProps {
  role: ChatRole;
  label?: string;
  children: ComponentChildren;
  class?: string;
}

const roleStyles: Record<ChatRole, { border: string; defaultLabel: string }> = {
  user: {
    border: "border-l-role-user",
    defaultLabel: "You",
  },
  assistant: {
    border: "border-l-role-assistant",
    defaultLabel: "Assistant",
  },
  tool: {
    border: "border-l-role-tool",
    defaultLabel: "Tool",
  },
  "tool-result": {
    border: "border-l-role-tool-result",
    defaultLabel: "Result",
  },
  system: {
    border: "border-l-role-system",
    defaultLabel: "System",
  },
};

export function ChatBubble({
  role,
  label,
  children,
  class: className = "",
}: ChatBubbleProps): JSX.Element {
  const style = roleStyles[role];
  const displayLabel = label ?? style.defaultLabel;

  return (
    <div
      class={`
        bg-surface rounded-lg p-4
        border-l-3 ${style.border}
        ${className}
      `}
    >
      <span class="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5 block">
        {displayLabel}
      </span>
      <div class="text-base text-text-primary">
        {children}
      </div>
    </div>
  );
}
