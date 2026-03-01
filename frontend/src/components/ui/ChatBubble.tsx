import type { ComponentChildren, JSX } from "preact";

type ChatRole = "user" | "assistant" | "tool" | "tool-result";

interface ChatBubbleProps {
  role: ChatRole;
  children: ComponentChildren;
  class?: string;
}

const roleStyles: Record<ChatRole, { border: string; label: string }> = {
  user: {
    border: "border-l-role-user",
    label: "You",
  },
  assistant: {
    border: "border-l-role-assistant",
    label: "Assistant",
  },
  tool: {
    border: "border-l-role-tool",
    label: "Tool",
  },
  "tool-result": {
    border: "border-l-role-tool-result",
    label: "Result",
  },
};

export function ChatBubble({
  role,
  children,
  class: className = "",
}: ChatBubbleProps): JSX.Element {
  const style = roleStyles[role];

  return (
    <div
      class={`
        bg-surface rounded-lg p-4
        border-l-3 ${style.border}
        ${className}
      `}
    >
      <span class="text-xs font-medium text-text-muted uppercase tracking-wide mb-1.5 block">
        {style.label}
      </span>
      <div class="text-base text-text-primary">
        {children}
      </div>
    </div>
  );
}
