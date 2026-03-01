import type { JSX } from "preact";
import { IconButton } from "./ui/index.js";

interface ComposerToolbarProps {
  onTemplates: () => void;
  onFiles: () => void;
  onHistory: () => void;
  onClose: () => void;
  class?: string;
}

/**
 * Toolbar for the Mobile Composer with action buttons.
 * Opens bottom sheets for templates, files, and history.
 */
export function ComposerToolbar({
  onTemplates,
  onFiles,
  onHistory,
  onClose,
  class: className = "",
}: ComposerToolbarProps): JSX.Element {
  return (
    <div
      class={`
        flex items-center justify-between px-4 py-2
        border-b border-border-subtle bg-bg-app
        ${className}
      `}
    >
      {/* Left side: action buttons */}
      <div class="flex items-center gap-1">
        <IconButton label="Insert template" onClick={onTemplates}>
          <TemplateIcon />
        </IconButton>
        <IconButton label="Insert file path" onClick={onFiles}>
          <FileIcon />
        </IconButton>
        <IconButton label="Recall previous message" onClick={onHistory}>
          <HistoryIcon />
        </IconButton>
      </div>

      {/* Right side: close button */}
      <IconButton label="Close composer" onClick={onClose}>
        <CloseIcon />
      </IconButton>
    </div>
  );
}

// Simple SVG icons for toolbar buttons
function TemplateIcon(): JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function FileIcon(): JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
    </svg>
  );
}

function HistoryIcon(): JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l4 2" />
    </svg>
  );
}

function CloseIcon(): JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
