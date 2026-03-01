import type { ComponentChildren, JSX } from "preact";

interface TitleProps {
  children: ComponentChildren;
  class?: string;
}

export function Title({ children, class: className = "" }: TitleProps): JSX.Element {
  return (
    <h1 class={`text-lg font-bold text-text-primary ${className}`}>
      {children}
    </h1>
  );
}

interface BodyProps {
  children: ComponentChildren;
  class?: string;
}

export function Body({ children, class: className = "" }: BodyProps): JSX.Element {
  return (
    <p class={`text-base font-normal text-text-primary ${className}`}>
      {children}
    </p>
  );
}

interface MetadataProps {
  children: ComponentChildren;
  class?: string;
}

export function Metadata({ children, class: className = "" }: MetadataProps): JSX.Element {
  return (
    <span class={`text-sm font-normal text-text-muted ${className}`}>
      {children}
    </span>
  );
}

interface CodeTextProps {
  children: ComponentChildren;
  class?: string;
  inline?: boolean;
}

export function CodeText({ children, class: className = "", inline = false }: CodeTextProps): JSX.Element {
  const baseClasses = "font-mono text-sm text-text-primary";

  if (inline) {
    return (
      <code class={`${baseClasses} bg-surface px-1.5 py-0.5 rounded ${className}`}>
        {children}
      </code>
    );
  }

  return (
    <pre class={`${baseClasses} bg-surface p-3 rounded-lg overflow-x-auto ${className}`}>
      <code>{children}</code>
    </pre>
  );
}
