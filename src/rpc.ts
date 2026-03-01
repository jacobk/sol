import { spawn, type ChildProcess } from "node:child_process";
import { createInterface, type Interface as ReadlineInterface } from "node:readline";

/** Default idle timeout: 10 minutes with no SSE listeners before killing subprocess */
const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

/** Callback for RPC events emitted from the subprocess stdout */
export type RpcEventCallback = (event: Record<string, unknown>) => void;

/** Tracks a single RPC subprocess and its associated state */
interface RpcProcess {
  process: ChildProcess;
  listeners: Set<RpcEventCallback>;
  readline: ReadlineInterface;
  idleTimer: ReturnType<typeof setTimeout> | null;
  killed: boolean;
}

/** Active RPC subprocesses keyed by session ID */
const activeProcesses = new Map<string, RpcProcess>();

/**
 * Spawn a `pi --mode rpc` subprocess for the given session.
 * Returns true if a new process was spawned, false if one already exists.
 */
export function spawnRpc(sessionId: string, sessionDir: string, cwd: string): boolean {
  if (activeProcesses.has(sessionId)) {
    return false;
  }

  const child = spawn("pi", ["--mode", "rpc", "--session-dir", sessionDir], {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env },
  });

  const rl = createInterface({ input: child.stdout! });

  const rpcProcess: RpcProcess = {
    process: child,
    listeners: new Set(),
    readline: rl,
    idleTimer: null,
    killed: false,
  };

  // Parse JSON lines from stdout and dispatch to all listeners
  rl.on("line", (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const event = JSON.parse(trimmed) as Record<string, unknown>;
      for (const callback of rpcProcess.listeners) {
        try {
          callback(event);
        } catch (err) {
          console.error(`[rpc] Listener error for session ${sessionId}:`, err);
        }
      }
    } catch {
      console.warn(`[rpc] Non-JSON line from session ${sessionId}:`, trimmed);
    }
  });

  // Log stderr for debugging
  child.stderr?.on("data", (data: Buffer) => {
    console.error(`[rpc] stderr (${sessionId}):`, data.toString());
  });

  // Handle subprocess exit
  child.on("exit", (code, signal) => {
    console.log(`[rpc] Process exited for session ${sessionId}: code=${code}, signal=${signal}`);
    // Notify listeners of the exit
    const exitEvent: Record<string, unknown> = {
      type: "rpc_exit",
      code,
      signal,
    };
    for (const callback of rpcProcess.listeners) {
      try {
        callback(exitEvent);
      } catch {
        // ignore listener errors during cleanup
      }
    }
    cleanup(sessionId);
  });

  child.on("error", (err) => {
    console.error(`[rpc] Process error for session ${sessionId}:`, err);
    const errorEvent: Record<string, unknown> = {
      type: "rpc_error",
      error: err.message,
    };
    for (const callback of rpcProcess.listeners) {
      try {
        callback(errorEvent);
      } catch {
        // ignore listener errors during cleanup
      }
    }
    cleanup(sessionId);
  });

  activeProcesses.set(sessionId, rpcProcess);

  // Start idle timer since there are no listeners yet
  startIdleTimer(sessionId);

  return true;
}

/**
 * Send a JSON command to the RPC subprocess stdin.
 * Returns true if the command was sent, false if no active process exists.
 */
export function sendCommand(sessionId: string, command: Record<string, unknown>): boolean {
  const rpc = activeProcesses.get(sessionId);
  if (!rpc || rpc.killed) {
    return false;
  }

  const json = JSON.stringify(command) + "\n";
  return rpc.process.stdin!.write(json);
}

/**
 * Register a listener for RPC events from the subprocess.
 * Clears any idle timer since we now have an active listener.
 */
export function onEvent(sessionId: string, callback: RpcEventCallback): void {
  const rpc = activeProcesses.get(sessionId);
  if (!rpc) return;

  rpc.listeners.add(callback);

  // Clear idle timer — we have an active listener
  if (rpc.idleTimer) {
    clearTimeout(rpc.idleTimer);
    rpc.idleTimer = null;
  }
}

/**
 * Remove a listener for RPC events.
 * Starts idle timer if no listeners remain.
 */
export function offEvent(sessionId: string, callback: RpcEventCallback): void {
  const rpc = activeProcesses.get(sessionId);
  if (!rpc) return;

  rpc.listeners.delete(callback);

  // Start idle timer if no listeners remain
  if (rpc.listeners.size === 0) {
    startIdleTimer(sessionId);
  }
}

/**
 * Check if an RPC subprocess is active for the given session.
 */
export function isConnected(sessionId: string): boolean {
  return activeProcesses.has(sessionId);
}

/**
 * Re-key an RPC subprocess under a new session ID.
 * Used when a temporary session ID needs to be replaced with the real one.
 * Returns true if successful, false if oldId not found or newId already exists.
 */
export function rekeyRpc(oldSessionId: string, newSessionId: string): boolean {
  const rpc = activeProcesses.get(oldSessionId);
  if (!rpc) return false;
  if (activeProcesses.has(newSessionId)) return false;

  activeProcesses.delete(oldSessionId);
  activeProcesses.set(newSessionId, rpc);
  return true;
}

/**
 * Kill the RPC subprocess for a session.
 * Sends abort command first, then terminates.
 */
export function killRpc(sessionId: string): void {
  const rpc = activeProcesses.get(sessionId);
  if (!rpc) return;

  // Send abort before marking as killed (sendCommand checks killed flag)
  try {
    sendCommand(sessionId, { type: "abort" });
  } catch {
    // ignore — process may already be dead
  }

  rpc.killed = true;

  // Give abort a moment, then force kill
  setTimeout(() => {
    try {
      rpc.process.kill("SIGTERM");
    } catch {
      // ignore — process may already be dead
    }
  }, 100);
}

/**
 * Terminate all active RPC subprocesses.
 * Called during server shutdown.
 */
export function killAllRpc(): void {
  for (const [sessionId] of activeProcesses) {
    killRpc(sessionId);
  }
}

/**
 * Get the number of active RPC subprocesses.
 */
export function getActiveCount(): number {
  return activeProcesses.size;
}

/**
 * Force-reset all internal state. Only for use in tests.
 */
export function _resetForTesting(): void {
  for (const [, rpc] of activeProcesses) {
    if (rpc.idleTimer) {
      clearTimeout(rpc.idleTimer);
    }
    rpc.readline.close();
    rpc.listeners.clear();
  }
  activeProcesses.clear();
}

/** Internal: clean up a subprocess entry from the map */
function cleanup(sessionId: string): void {
  const rpc = activeProcesses.get(sessionId);
  if (!rpc) return;

  if (rpc.idleTimer) {
    clearTimeout(rpc.idleTimer);
    rpc.idleTimer = null;
  }

  rpc.readline.close();
  rpc.listeners.clear();
  activeProcesses.delete(sessionId);
}

/** Internal: start idle timeout timer */
function startIdleTimer(sessionId: string): void {
  const rpc = activeProcesses.get(sessionId);
  if (!rpc) return;

  if (rpc.idleTimer) {
    clearTimeout(rpc.idleTimer);
  }

  rpc.idleTimer = setTimeout(() => {
    console.log(`[rpc] Idle timeout for session ${sessionId}, killing subprocess`);
    killRpc(sessionId);
  }, IDLE_TIMEOUT_MS);
}
