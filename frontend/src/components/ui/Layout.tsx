import type { ComponentChildren, JSX } from "preact";

interface StackProps {
  children: ComponentChildren;
  direction?: "vertical" | "horizontal";
  gap?: 1 | 2 | 3 | 4 | 6 | 8;
  class?: string;
}

const gapClasses: Record<number, string> = {
  1: "gap-1",
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  6: "gap-6",
  8: "gap-8",
};

export function Stack({
  children,
  direction = "vertical",
  gap = 2,
  class: className = "",
}: StackProps): JSX.Element {
  const dirClass = direction === "vertical" ? "flex-col" : "flex-row";
  return (
    <div class={`flex ${dirClass} ${gapClasses[gap]} ${className}`}>
      {children}
    </div>
  );
}

interface DividerProps {
  class?: string;
}

export function Divider({ class: className = "" }: DividerProps): JSX.Element {
  return <hr class={`border-border-subtle border-t ${className}`} />;
}

interface ContainerProps {
  children: ComponentChildren;
  class?: string;
}

export function Container({ children, class: className = "" }: ContainerProps): JSX.Element {
  return (
    <div class={`px-4 w-full ${className}`}>
      {children}
    </div>
  );
}
