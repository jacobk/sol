import type { JSX } from "preact";
import { useState, useEffect, useRef, useCallback } from "preact/hooks";
import { Badge, Body, Button, Container, IconButton, Metadata, Stack, Title } from "./ui/index.js";
import { SessionCard } from "./SessionCard.js";

interface SearchResult {
  path: string;
  id: string;
  cwd: string;
  name?: string;
  created: string;
  modified: string;
  messageCount: number;
  firstMessage: string;
  hitCount: number;
}

type LoadState = "idle" | "loading" | "error";

const DEBOUNCE_MS = 300;

interface SearchProps {
  onSelectSession: (id: string, query: string) => void;
  onBack: () => void;
}

export function Search({ onSelectSession, onBack }: SearchProps): JSX.Element {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setLoadState("idle");
      return;
    }

    setLoadState("loading");
    setErrorMessage("");
    try {
      const res = await fetch(
        `/api/sessions/search?q=${encodeURIComponent(searchQuery)}`
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data: SearchResult[] = await res.json();
      setResults(data);
      setLoadState("idle");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      setLoadState("error");
    }
  }, []);

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      void performSearch(query);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, performSearch]);

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div class="min-h-screen bg-bg-app">
      {/* Header */}
      <div class="sticky top-0 z-10 bg-bg-app border-b border-border-subtle">
        <Container class="py-3 flex items-center gap-3">
          <IconButton label="Back" onClick={onBack}>
            ←
          </IconButton>
          <div class="flex-1">
            <input
              ref={inputRef}
              type="search"
              value={query}
              placeholder="Search sessions…"
              onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
              class="w-full min-h-[var(--spacing-touch)] px-3 rounded-lg bg-surface text-text-primary placeholder:text-text-muted border border-border-subtle focus:outline-none focus:border-accent text-base"
            />
          </div>
          {query && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuery("");
                setResults([]);
                inputRef.current?.focus();
              }}
            >
              Clear
            </Button>
          )}
        </Container>
      </div>

      {/* Content */}
      <Container class="py-4">
        {loadState === "error" && (
          <div class="bg-state-error/10 text-state-error rounded-lg p-4 mb-4">
            <Body class="text-state-error">Search failed: {errorMessage}</Body>
          </div>
        )}

        {loadState === "loading" && (
          <div class="flex justify-center py-8">
            <Metadata>Searching…</Metadata>
          </div>
        )}

        {loadState === "idle" && query.trim() && results.length === 0 && (
          <div class="flex flex-col items-center justify-center py-16 px-4">
            <div class="text-4xl mb-4">🔍</div>
            <Title class="mb-2 text-center">No results</Title>
            <Metadata class="text-center">
              No sessions match "{query}"
            </Metadata>
          </div>
        )}

        {loadState === "idle" && !query.trim() && (
          <div class="flex flex-col items-center justify-center py-16 px-4">
            <div class="text-4xl mb-4">🔍</div>
            <Metadata class="text-center">
              Type to search across all sessions
            </Metadata>
          </div>
        )}

        {results.length > 0 && (
          <Stack direction="vertical" gap={2}>
            <Metadata class="block px-1 mb-1">
              {results.length} session{results.length !== 1 ? "s" : ""} found
            </Metadata>
            {results.map((result) => (
              <SessionCard
                key={result.id}
                session={result}
                onSelect={() => onSelectSession(result.id, query)}
                extraBadge={
                  result.hitCount > 0 ? (
                    <Badge variant="accent">
                      {result.hitCount} match{result.hitCount !== 1 ? "es" : ""}
                    </Badge>
                  ) : undefined
                }
              />
            ))}
          </Stack>
        )}
      </Container>
    </div>
  );
}
