import type { JSX } from "preact";
import { useState, useEffect, useMemo } from "preact/hooks";
import { BottomSheet, Metadata } from "./ui/index.js";

interface TemplatePickerSheetProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  onSelect: (template: string) => void;
}

/** Slash command from RPC response (matches pi-agent RpcSlashCommand) */
interface RpcSlashCommand {
  name: string;
  description?: string;
  source: "extension" | "prompt" | "skill";
  location?: "user" | "project" | "path";
  path?: string;
}

/** RPC response structure for get_commands */
interface CommandsResponse {
  type: "response";
  command: "get_commands";
  success: boolean;
  data?: {
    commands: RpcSlashCommand[];
  };
  error?: string;
}

type LoadState = "idle" | "loading" | "error";

/**
 * Bottom sheet for browsing and selecting prompt templates and skills.
 * Fetches from `/api/session/:id/commands` via RPC.
 */
export function TemplatePickerSheet({
  open,
  onClose,
  sessionId,
  onSelect,
}: TemplatePickerSheetProps): JSX.Element {
  const [commands, setCommands] = useState<RpcSlashCommand[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [loadedForSession, setLoadedForSession] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  // Reset cache when session changes
  useEffect(() => {
    if (loadedForSession !== null && loadedForSession !== sessionId) {
      setCommands([]);
      setLoadedForSession(null);
      setLoadState("idle");
    }
  }, [sessionId, loadedForSession]);

  // Reset filter when sheet opens
  useEffect(() => {
    if (open) {
      setFilter("");
    }
  }, [open]);

  // Fetch commands when sheet opens
  useEffect(() => {
    if (!open) return;
    if (loadedForSession === sessionId) return; // Already loaded for this session

    const fetchCommands = async (): Promise<void> => {
      setLoadState("loading");
      setErrorMessage("");

      try {
        const res = await fetch(`/api/session/${encodeURIComponent(sessionId)}/commands`);
        if (!res.ok) {
          const err = (await res.json().catch(() => ({ error: "Unknown error" }))) as {
            error: string;
          };
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const data = (await res.json()) as CommandsResponse;
        if (!data.success) {
          throw new Error(data.error || "Failed to load commands");
        }

        // Get commands from data.commands (correct structure)
        const allCommands = data.data?.commands ?? [];

        setCommands(allCommands);
        setLoadedForSession(sessionId);
        setLoadState("idle");
      } catch (err) {
        console.error("Failed to fetch commands:", err);
        setErrorMessage(err instanceof Error ? err.message : "Unknown error");
        setLoadState("error");
      }
    };

    void fetchCommands();
  }, [open, sessionId, loadedForSession]);

  // Filter commands based on search input
  const filteredCommands = useMemo(() => {
    if (!filter.trim()) return commands;
    const lowerFilter = filter.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(lowerFilter) ||
        cmd.description?.toLowerCase().includes(lowerFilter)
    );
  }, [commands, filter]);

  const handleSelect = (cmd: RpcSlashCommand): void => {
    // Format based on source type
    const template = cmd.source === "skill" ? `/skill:${cmd.name} ` : `/${cmd.name} `;
    onSelect(template);
    onClose();
  };

  /** Get display label for a command */
  const getLabel = (cmd: RpcSlashCommand): string => {
    return cmd.source === "skill" ? `/skill:${cmd.name}` : `/${cmd.name}`;
  };

  /** Get source badge text */
  const getSourceBadge = (cmd: RpcSlashCommand): string => {
    switch (cmd.source) {
      case "skill":
        return "skill";
      case "prompt":
        return "prompt";
      case "extension":
        return "ext";
      default:
        return "";
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Templates">
      {loadState === "loading" && (
        <div class="py-8 text-center">
          <Metadata>Loading templates…</Metadata>
        </div>
      )}

      {loadState === "error" && (
        <div class="py-8 text-center">
          <Metadata class="text-state-error">{errorMessage}</Metadata>
        </div>
      )}

      {loadState === "idle" && (
        <div class="flex flex-col gap-2">
          {/* Filter input */}
          {commands.length > 5 && (
            <input
              type="text"
              value={filter}
              onInput={(e) => setFilter((e.target as HTMLInputElement).value)}
              placeholder="Filter templates…"
              class="w-full px-3 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            />
          )}

          {/* Scrollable list */}
          <div class="max-h-64 overflow-y-auto -mx-1">
            {filteredCommands.length === 0 ? (
              <div class="py-8 text-center">
                <Metadata>No templates found</Metadata>
              </div>
            ) : (
              <div class="flex flex-col">
                {filteredCommands.map((cmd) => (
                  <button
                    key={cmd.name}
                    type="button"
                    onClick={() => handleSelect(cmd)}
                    class="flex items-start gap-3 px-3 py-3 text-left rounded-lg hover:bg-[var(--color-surface)] active:bg-[var(--color-surface-hover)] transition-colors min-h-[var(--spacing-touch)]"
                  >
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <span class="font-mono text-sm text-[var(--color-text-primary)] truncate">
                          {getLabel(cmd)}
                        </span>
                        <span class="flex-shrink-0 px-1.5 py-0.5 text-xs rounded bg-[var(--color-surface-hover)] text-[var(--color-text-muted)]">
                          {getSourceBadge(cmd)}
                        </span>
                      </div>
                      {cmd.description && (
                        <p class="mt-0.5 text-sm text-[var(--color-text-muted)] line-clamp-2">
                          {cmd.description}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
