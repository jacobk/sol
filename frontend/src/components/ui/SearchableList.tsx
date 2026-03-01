import type { JSX } from "preact";
import { useState, useMemo, useCallback } from "preact/hooks";
import { Input } from "./Input.js";

export interface SearchableListItem {
  id: string;
  label: string;
  description?: string;
  /** Optional secondary text shown in muted style */
  secondary?: string;
}

interface SearchableListProps {
  items: SearchableListItem[];
  onSelect: (item: SearchableListItem) => void;
  placeholder?: string;
  emptyMessage?: string;
  class?: string;
}

/**
 * A searchable list component with filtering and selection.
 * Used by picker sheets (templates, files, history).
 */
export function SearchableList({
  items,
  onSelect,
  placeholder = "Search…",
  emptyMessage = "No items found",
  class: className = "",
}: SearchableListProps): JSX.Element {
  const [query, setQuery] = useState("");

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const lowerQuery = query.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(lowerQuery) ||
        item.description?.toLowerCase().includes(lowerQuery) ||
        item.secondary?.toLowerCase().includes(lowerQuery)
    );
  }, [items, query]);

  const handleSelect = useCallback(
    (item: SearchableListItem) => {
      onSelect(item);
    },
    [onSelect]
  );

  return (
    <div class={`flex flex-col gap-3 ${className}`}>
      {/* Search input */}
      <Input
        value={query}
        onInput={setQuery}
        placeholder={placeholder}
        type="search"
      />

      {/* Results list */}
      <div class="flex flex-col gap-1 max-h-[50dvh] overflow-y-auto -mx-2">
        {filteredItems.length === 0 ? (
          <div class="px-4 py-8 text-center text-text-muted text-sm">
            {emptyMessage}
          </div>
        ) : (
          filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item)}
              class="
                w-full text-left px-4 py-3 rounded-lg
                min-h-[var(--spacing-touch)]
                active:bg-surface transition-colors duration-100
                focus:outline-none focus-visible:bg-surface
              "
            >
              <div class="flex flex-col gap-0.5">
                <span class="text-text-primary text-base font-medium truncate">
                  {item.label}
                </span>
                {item.description && (
                  <span class="text-text-muted text-sm line-clamp-2">
                    {item.description}
                  </span>
                )}
                {item.secondary && (
                  <span class="text-text-muted/60 text-xs font-mono truncate">
                    {item.secondary}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
