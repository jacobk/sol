import type { ComponentChildren, JSX } from "preact";

type BadgeVariant = "default" | "accent" | "success" | "error" | "warning";

interface BadgeProps {
  children: ComponentChildren;
  variant?: BadgeVariant;
  class?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface text-text-muted",
  accent: "bg-accent/20 text-accent-text",
  success: "bg-state-success/20 text-state-success",
  error: "bg-state-error/20 text-state-error",
  warning: "bg-state-warning/20 text-state-warning",
};

export function Badge({
  children,
  variant = "default",
  class: className = "",
}: BadgeProps): JSX.Element {
  return (
    <span
      class={`
        inline-flex items-center px-2 py-0.5 rounded-full
        text-xs font-medium whitespace-nowrap
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
}
