import type { JSX } from "preact";
import { useState, useCallback } from "preact/hooks";
import { Badge } from "./ui/index.js";
import { BottomSheet } from "./ui/BottomSheet.js";

/** Lightweight model info matching the shape returned by pi RPC */
interface ModelInfo {
  id: string;
  name: string;
  provider: string;
}

interface ModelSwitcherProps {
  sessionId: string;
  isRpcConnected: boolean;
  currentModel?: string;
  onModelChange?: (modelName: string) => void;
}

interface ModelsRpcResponse {
  type: "response";
  command: "get_available_models";
  success: boolean;
  data?: {
    models: ModelInfo[];
  };
  error?: string;
}

type LoadState = "idle" | "loading" | "error";

export function ModelSwitcher({
  sessionId,
  isRpcConnected,
  currentModel,
  onModelChange,
}: ModelSwitcherProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [switching, setSwitching] = useState(false);

  const displayModel = currentModel
    ? currentModel.length > 20
      ? currentModel.slice(0, 18) + "…"
      : currentModel
    : "Model";

  const fetchModels = useCallback(async () => {
    setLoadState("loading");
    try {
      const res = await fetch(
        `/api/session/${encodeURIComponent(sessionId)}/models`
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: ModelsRpcResponse = await res.json();
      if (!data.success || !data.data) {
        throw new Error(data.error ?? "Unknown error");
      }
      setModels(data.data.models);
      setLoadState("idle");
    } catch {
      setLoadState("error");
    }
  }, [sessionId]);

  const handleOpen = useCallback(() => {
    if (!isRpcConnected) return;
    setOpen(true);
    void fetchModels();
  }, [isRpcConnected, fetchModels]);

  const handleSelectModel = useCallback(
    async (model: ModelInfo) => {
      if (model.name === currentModel) {
        setOpen(false);
        return;
      }
      setSwitching(true);
      try {
        const res = await fetch(
          `/api/session/${encodeURIComponent(sessionId)}/model`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: model.provider, modelId: model.id }),
          }
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        onModelChange?.(model.name);
        setOpen(false);
      } catch {
        // Stay open so user can retry
      } finally {
        setSwitching(false);
      }
    },
    [sessionId, currentModel, onModelChange]
  );

  // Read-only badge for historical sessions
  if (!isRpcConnected) {
    if (!currentModel) return <></>;
    return <Badge variant="default">{displayModel}</Badge>;
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        class="min-w-[var(--spacing-touch)] min-h-[var(--spacing-touch)] flex items-center justify-center"
        aria-label={`Current model: ${currentModel ?? "unknown"}. Tap to switch.`}
      >
        <Badge variant="accent">{displayModel}</Badge>
      </button>

      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Switch Model"
      >
        {loadState === "loading" && (
          <div class="py-8 text-center text-text-muted text-sm">
            Loading models…
          </div>
        )}

        {loadState === "error" && (
          <div class="py-8 text-center">
            <p class="text-state-error text-sm mb-3">Failed to load models</p>
            <button
              type="button"
              onClick={() => void fetchModels()}
              class="text-accent text-sm min-h-[var(--spacing-touch)] px-4"
            >
              Retry
            </button>
          </div>
        )}

        {loadState === "idle" && models.length === 0 && (
          <div class="py-8 text-center text-text-muted text-sm">
            No models available
          </div>
        )}

        {loadState === "idle" && models.length > 0 && (
          <div class="flex flex-col gap-1">
            {models.map((model) => {
              const isActive = model.name === currentModel;
              return (
                <button
                  key={model.id}
                  type="button"
                  onClick={() => void handleSelectModel(model)}
                  disabled={switching}
                  class={`
                    w-full text-left px-4 py-3 rounded-lg
                    min-h-[var(--spacing-touch)]
                    flex items-center justify-between
                    transition-colors duration-100
                    ${isActive
                      ? "bg-accent/20 text-accent-text"
                      : "text-text-primary active:bg-surface"
                    }
                    ${switching ? "opacity-50" : ""}
                  `}
                >
                  <div class="flex flex-col min-w-0 flex-1">
                    <span class="text-sm font-medium truncate">{model.name}</span>
                    <span class="text-xs text-text-muted truncate">{model.provider}</span>
                  </div>
                  {isActive && (
                    <span class="text-accent-text ml-2 flex-shrink-0">✓</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </BottomSheet>
    </>
  );
}
