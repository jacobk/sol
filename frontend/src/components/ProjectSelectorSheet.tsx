import type { JSX } from "preact";
import { useCallback } from "preact/hooks";
import { BottomSheet, Body, Button } from "./ui/index.js";

interface ProjectSelectorSheetProps {
  /** Whether the sheet is open */
  open: boolean;
  /** Called when the sheet should close */
  onClose: () => void;
  /** List of project working directories */
  projects: string[];
  /** Called when user selects a project */
  onSelect: (cwd: string) => void;
  /** Whether a creation operation is in progress */
  loading?: boolean;
}

/**
 * Extract display name from a project path.
 * Shows the last directory component for brevity.
 */
function projectDisplayName(project: string): string {
  const parts = project.split("/").filter(Boolean);
  return parts[parts.length - 1] || project;
}

/**
 * ProjectSelectorSheet - Bottom sheet for selecting a project to create a new session in.
 *
 * Shows a list of projects (cwds) from existing sessions.
 * User selects a project to create a new session in that working directory.
 */
export function ProjectSelectorSheet({
  open,
  onClose,
  projects,
  onSelect,
  loading = false,
}: ProjectSelectorSheetProps): JSX.Element {
  const handleSelect = useCallback((cwd: string) => {
    onSelect(cwd);
  }, [onSelect]);

  return (
    <BottomSheet open={open} onClose={onClose} title="New Session">
      <div class="flex flex-col gap-2">
        <Body class="text-text-muted mb-2">
          Select a project to start a new session:
        </Body>

        {projects.length === 0 ? (
          <Body class="text-text-muted text-center py-4">
            No projects found. Start a pi session from your terminal first.
          </Body>
        ) : (
          <div class="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
            {projects.map((project) => (
              <Button
                key={project}
                variant="secondary"
                class="w-full justify-start text-left"
                onClick={() => handleSelect(project)}
                disabled={loading}
              >
                <div class="flex flex-col items-start overflow-hidden">
                  <span class="font-medium truncate w-full">
                    {projectDisplayName(project)}
                  </span>
                  <span class="text-xs text-text-muted truncate w-full">
                    {project}
                  </span>
                </div>
              </Button>
            ))}
          </div>
        )}

        <Button
          variant="ghost"
          class="w-full mt-2"
          onClick={onClose}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </BottomSheet>
  );
}
