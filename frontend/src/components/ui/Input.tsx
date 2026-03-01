import type { JSX } from "preact";
import { useRef, useEffect, useCallback } from "preact/hooks";

interface InputProps {
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "url" | "search";
  disabled?: boolean;
  class?: string;
  id?: string;
}

export function Input({
  value,
  onInput,
  placeholder,
  type = "text",
  disabled = false,
  class: className = "",
  id,
}: InputProps): JSX.Element {
  return (
    <input
      id={id}
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onInput={(e) => onInput((e.target as HTMLInputElement).value)}
      class={`
        w-full min-h-[var(--spacing-touch)] px-3 rounded-lg
        bg-surface text-text-primary placeholder:text-text-muted
        border border-border-subtle
        focus:outline-none focus:border-accent
        disabled:opacity-40
        text-base
        ${className}
      `}
    />
  );
}

interface TextareaProps {
  value: string;
  onInput: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  maxRows?: number;
  class?: string;
  id?: string;
  onKeyDown?: (e: KeyboardEvent) => void;
}

export function Textarea({
  value,
  onInput,
  placeholder,
  disabled = false,
  maxRows = 8,
  class: className = "",
  id,
  onKeyDown,
}: TextareaProps): JSX.Element {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const lineHeight = parseInt(getComputedStyle(el).lineHeight) || 20;
    const maxHeight = lineHeight * maxRows;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [maxRows]);

  useEffect(() => {
    resize();
  }, [value, resize]);

  return (
    <textarea
      ref={ref}
      id={id}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      rows={1}
      onInput={(e) => {
        onInput((e.target as HTMLTextAreaElement).value);
        resize();
      }}
      onKeyDown={onKeyDown}
      class={`
        w-full min-h-[var(--spacing-touch)] px-3 py-2.5 rounded-lg resize-none
        bg-surface text-text-primary placeholder:text-text-muted
        border border-border-subtle
        focus:outline-none focus:border-accent
        disabled:opacity-40
        text-base leading-relaxed
        ${className}
      `}
    />
  );
}
