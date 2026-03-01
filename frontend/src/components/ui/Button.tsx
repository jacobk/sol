import type { ComponentChildren, JSX } from "preact";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  children: ComponentChildren;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  class?: string;
  onClick?: (e: MouseEvent) => void;
  type?: "button" | "submit" | "reset";
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white active:bg-accent-hover",
  secondary: "bg-surface text-text-primary active:bg-surface-2",
  ghost: "bg-transparent text-text-muted active:bg-surface",
  danger: "bg-transparent text-state-error active:bg-surface",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 text-sm min-h-[var(--spacing-touch)]",
  md: "px-4 text-base min-h-[var(--spacing-touch)]",
  lg: "px-6 text-lg min-h-[var(--spacing-touch)]",
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  class: className = "",
  onClick,
  type = "button",
}: ButtonProps): JSX.Element {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      class={`
        inline-flex items-center justify-center rounded-lg font-medium
        transition-colors duration-100 select-none
        min-w-[var(--spacing-touch)]
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
        disabled:opacity-40 disabled:pointer-events-none
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      {loading ? (
        <span class="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        children
      )}
    </button>
  );
}

interface IconButtonProps {
  children: ComponentChildren;
  label: string;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  class?: string;
  onClick?: (e: MouseEvent) => void;
}

export function IconButton({
  children,
  label,
  variant = "ghost",
  disabled = false,
  loading = false,
  class: className = "",
  onClick,
}: IconButtonProps): JSX.Element {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled || loading}
      onClick={onClick}
      class={`
        inline-flex items-center justify-center rounded-lg
        transition-colors duration-100 select-none
        w-[var(--spacing-touch)] h-[var(--spacing-touch)]
        focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent
        disabled:opacity-40 disabled:pointer-events-none
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {loading ? (
        <span class="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        children
      )}
    </button>
  );
}
