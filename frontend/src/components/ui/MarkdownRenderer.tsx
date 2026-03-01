import type { JSX } from "preact";
import { useMemo } from "preact/hooks";
import { marked } from "marked";
import DOMPurify from "dompurify";

interface MarkdownRendererProps {
  /** Raw markdown text to render */
  content: string;
  /** Additional CSS classes to apply to the container */
  class?: string;
}

// Configure marked for terminal-style rendering
marked.setOptions({
  gfm: true, // GitHub Flavored Markdown
  breaks: true, // Convert \n to <br>
});

/**
 * Terminal-style markdown renderer.
 *
 * Parses markdown using `marked` and renders with sanitized HTML.
 * Applies `.markdown-prose` styles from index.css for terminal aesthetic.
 *
 * Handles: headings, bold/italic, inline code, fenced code blocks,
 * lists, links, blockquotes, tables, horizontal rules.
 */
export function MarkdownRenderer({
  content,
  class: className = "",
}: MarkdownRendererProps): JSX.Element {
  const sanitizedHtml = useMemo(() => {
    if (!content) return "";

    // Parse markdown to HTML
    const rawHtml = marked.parse(content, { async: false }) as string;

    // Sanitize to prevent XSS
    const clean = DOMPurify.sanitize(rawHtml, {
      // Allow safe HTML elements
      ALLOWED_TAGS: [
        "h1", "h2", "h3", "h4", "h5", "h6",
        "p", "br", "hr",
        "strong", "b", "em", "i", "u", "s", "del",
        "a",
        "code", "pre",
        "ul", "ol", "li",
        "blockquote",
        "table", "thead", "tbody", "tr", "th", "td",
        "img",
        "input", // For GFM task lists
      ],
      // Allow safe attributes
      ALLOWED_ATTR: [
        "href", "title", "alt", "src",
        "class",
        "type", "checked", "disabled", // For checkboxes
      ],
      // Open links in new tab safely
      ADD_ATTR: ["target", "rel"],
    });

    return clean;
  }, [content]);

  // Handle link clicks to open in new tab
  const handleClick = (e: MouseEvent): void => {
    const target = e.target as HTMLElement;
    if (target.tagName === "A") {
      const link = target as HTMLAnchorElement;
      // External links open in new tab
      if (link.href && !link.href.startsWith(window.location.origin)) {
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
    }
  };

  if (!content) {
    return <div class={`markdown-prose ${className}`} />;
  }

  return (
    <div
      class={`markdown-prose ${className}`}
      onClick={handleClick}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
