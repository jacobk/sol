import type { JSX, ComponentChildren } from "preact";
import { useState, useCallback } from "preact/hooks";

interface ToolbarAction {
  /** Unique key for the action */
  key: string;
  /** Text label to display */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Whether the action is disabled */
  disabled?: boolean;
  /** Variant for visual distinction */
  variant?: "default" | "primary" | "accent";
}

interface ToolbarProps {
  /** Array of action buttons to display */
  actions: ToolbarAction[];
  /** Whether the toolbar starts collapsed */
  defaultCollapsed?: boolean;
  /** Additional CSS classes */
  class?: string;
}

/**
 * Floating collapsible toolbar.
 *
 * - Positioned top-right, floating over content
 * - Semi-transparent pill with backdrop blur
 * - Compact text labels (no icons)
 * - Collapsible to a single toggle button
 */
export function Toolbar({
  actions,
  defaultCollapsed = false,
  class: className = "",
}: ToolbarProps): JSX.Element {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const toggleCollapsed = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={toggleCollapsed}
        class={`
          bg-surface-2/90 backdrop-blur-sm
          rounded-full px-3 py-2
          text-sm font-medium text-text-muted
          active:bg-surface active:text-text-primary
          transition-colors duration-100
          min-h-[var(--spacing-touch)] min-w-[var(--spacing-touch)]
          flex items-center justify-center
          shadow-lg
          ${className}
        `}
        aria-label="Expand toolbar"
      >
        Menu
      </button>
    );
  }

  return (
    <div
      class={`
        bg-surface-2/90 backdrop-blur-sm
        rounded-full px-2 py-1.5
        flex items-center gap-1
        shadow-lg
        ${className}
      `}
    >
      {actions.map((action) => (
        <ToolbarButton
          key={action.key}
          onClick={action.onClick}
          disabled={action.disabled}
          variant={action.variant}
        >
          {action.label}
        </ToolbarButton>
      ))}
      <ToolbarButton onClick={toggleCollapsed} variant="default">
        Close
      </ToolbarButton>
    </div>
  );
}

interface ToolbarButtonProps {
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "primary" | "accent";
  children: ComponentChildren;
}

function ToolbarButton({
  onClick,
  disabled = false,
  variant = "default",
  children,
}: ToolbarButtonProps): JSX.Element {
  const variantClasses = {
    default: "text-text-muted active:text-text-primary",
    primary: "text-text-primary",
    accent: "text-accent-text active:text-accent",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      class={`
        px-2.5 py-1.5 rounded-full
        text-sm font-medium
        ${variantClasses[variant]}
        active:bg-surface
        transition-colors duration-100
        min-h-[var(--spacing-touch)]
        disabled:opacity-40 disabled:pointer-events-none
      `}
    >
      {children}
    </button>
  );
}
