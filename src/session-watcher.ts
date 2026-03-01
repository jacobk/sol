import { stat, watch, type FSWatcher } from "node:fs";
import { createReadStream } from "node:fs";

/** Callback for new session entries parsed from the JSONL file */
export type SessionEntryCallback = (entry: Record<string, unknown>) => void;

/** Tracks a single file watcher and its listeners */
interface FileWatcher {
  filePath: string;
  listeners: Set<SessionEntryCallback>;
  fsWatcher: FSWatcher | null;
  pollTimer: ReturnType<typeof setInterval> | null;
  lastSize: number;
  closed: boolean;
}

/** Active file watchers keyed by session ID */
const activeWatchers = new Map<string, FileWatcher>();

/**
 * Start watching a session JSONL file for new entries.
 * Returns true if a new watcher was created, false if one already exists.
 */
export function startWatching(sessionId: string, filePath: string): boolean {
  if (activeWatchers.has(sessionId)) {
    return false;
  }

  const watcher: FileWatcher = {
    filePath,
    listeners: new Set(),
    fsWatcher: null,
    pollTimer: null,
    lastSize: 0,
    closed: false,
  };

  activeWatchers.set(sessionId, watcher);

  // Get initial file size so we only emit NEW entries
  void initWatcher(sessionId, watcher);

  return true;
}

async function initWatcher(sessionId: string, watcher: FileWatcher): Promise<void> {
  try {
    const stats = await statAsync(watcher.filePath);
    watcher.lastSize = stats.size;
  } catch {
    watcher.lastSize = 0;
  }

  // Use fs.watch for immediate notification, with poll fallback
  try {
    watcher.fsWatcher = watch(watcher.filePath, () => {
      void checkForNewEntries(sessionId);
    });
    watcher.fsWatcher.on("error", () => {
      // Fall back to polling if fs.watch fails
      if (!watcher.pollTimer && !watcher.closed) {
        watcher.pollTimer = setInterval(() => {
          void checkForNewEntries(sessionId);
        }, 1000);
      }
    });
  } catch {
    // fs.watch not available — use polling
  }

  // Always poll as a safety net (fs.watch can miss events on some systems)
  if (!watcher.pollTimer) {
    watcher.pollTimer = setInterval(() => {
      void checkForNewEntries(sessionId);
    }, 1000);
  }
}

/**
 * Check if the file has grown and read new entries.
 */
async function checkForNewEntries(sessionId: string): Promise<void> {
  const watcher = activeWatchers.get(sessionId);
  if (!watcher || watcher.closed) return;

  try {
    const stats = await statAsync(watcher.filePath);
    if (stats.size <= watcher.lastSize) return;

    const newData = await readRange(watcher.filePath, watcher.lastSize, stats.size);
    watcher.lastSize = stats.size;

    // Parse new lines
    const lines = newData.split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const entry = JSON.parse(trimmed) as Record<string, unknown>;
        for (const callback of watcher.listeners) {
          try {
            callback(entry);
          } catch (err) {
            console.error(`[session-watcher] Listener error for ${sessionId}:`, err);
          }
        }
      } catch {
        // Non-JSON line — skip
      }
    }
  } catch (err) {
    // File might have been deleted or become inaccessible
    console.warn(`[session-watcher] Error reading ${watcher.filePath}:`, err);
  }
}

/**
 * Register a listener for new session entries.
 */
export function onEntry(sessionId: string, callback: SessionEntryCallback): void {
  const watcher = activeWatchers.get(sessionId);
  if (!watcher) return;
  watcher.listeners.add(callback);
}

/**
 * Remove a listener.
 * If no listeners remain, stops watching after a delay.
 */
export function offEntry(sessionId: string, callback: SessionEntryCallback): void {
  const watcher = activeWatchers.get(sessionId);
  if (!watcher) return;
  watcher.listeners.delete(callback);

  // Clean up if no listeners remain
  if (watcher.listeners.size === 0) {
    stopWatching(sessionId);
  }
}

/**
 * Stop watching a session file and clean up.
 */
export function stopWatching(sessionId: string): void {
  const watcher = activeWatchers.get(sessionId);
  if (!watcher) return;

  watcher.closed = true;
  if (watcher.fsWatcher) {
    watcher.fsWatcher.close();
    watcher.fsWatcher = null;
  }
  if (watcher.pollTimer) {
    clearInterval(watcher.pollTimer);
    watcher.pollTimer = null;
  }
  watcher.listeners.clear();
  activeWatchers.delete(sessionId);
}

/**
 * Stop all active watchers. Called during server shutdown.
 */
export function stopAllWatchers(): void {
  for (const [sessionId] of activeWatchers) {
    stopWatching(sessionId);
  }
}

/**
 * Check if a session is being watched.
 */
export function isWatching(sessionId: string): boolean {
  return activeWatchers.has(sessionId);
}

/**
 * Get count of active watchers.
 */
export function getWatcherCount(): number {
  return activeWatchers.size;
}

// --- Utility functions ---

function statAsync(filePath: string): Promise<{ size: number }> {
  return new Promise((resolve, reject) => {
    stat(filePath, (err, stats) => {
      if (err) reject(err);
      else resolve({ size: stats.size });
    });
  });
}

function readRange(filePath: string, start: number, end: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = createReadStream(filePath, { start, end: end - 1 });
    stream.on("data", (chunk: Buffer | string) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    stream.on("error", reject);
  });
}
