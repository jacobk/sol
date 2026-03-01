import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";

// We need a fresh mockReadline per spawn call, so use a factory
let mockReadlines: EventEmitter[] = [];
vi.mock("node:readline", () => ({
  createInterface: () => {
    const rl = new EventEmitter();
    (rl as EventEmitter & { close: () => void }).close = vi.fn();
    mockReadlines.push(rl);
    return rl;
  },
}));

const mockSpawn = vi.fn();
vi.mock("node:child_process", () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));

const {
  spawnRpc, sendCommand, onEvent, offEvent, killRpc, killAllRpc,
  isConnected, getActiveCount, _resetForTesting,
} = await import("./rpc.js");

/** Create a mock child process with EventEmitter behavior */
function createMockChild() {
  const child = new EventEmitter();
  const stdin = { write: vi.fn().mockReturnValue(true), end: vi.fn() };
  const stdout = new EventEmitter();
  const stderr = new EventEmitter();
  Object.assign(child, { stdout, stderr, stdin, kill: vi.fn(), pid: 12345 });
  return child as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
    kill: ReturnType<typeof vi.fn>;
  };
}

describe("rpc", () => {
  let mockChild: ReturnType<typeof createMockChild>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    _resetForTesting();
    mockReadlines = [];
    mockChild = createMockChild();
    mockSpawn.mockReturnValue(mockChild);
  });

  afterEach(() => {
    _resetForTesting();
    vi.useRealTimers();
  });

  describe("spawnRpc", () => {
    it("spawns a pi --mode rpc subprocess", () => {
      const result = spawnRpc("sess-1", "/sessions/dir", "/project/cwd");

      expect(result).toBe(true);
      expect(mockSpawn).toHaveBeenCalledWith(
        "pi",
        ["--mode", "rpc", "--session-dir", "/sessions/dir"],
        expect.objectContaining({ cwd: "/project/cwd", stdio: ["pipe", "pipe", "pipe"] })
      );
    });

    it("returns false if session already has an active process", () => {
      spawnRpc("sess-1", "/sessions/dir", "/project/cwd");
      const result = spawnRpc("sess-1", "/sessions/dir", "/project/cwd");

      expect(result).toBe(false);
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });

    it("tracks active processes", () => {
      expect(isConnected("sess-1")).toBe(false);
      spawnRpc("sess-1", "/sessions/dir", "/project/cwd");
      expect(isConnected("sess-1")).toBe(true);
    });
  });

  describe("sendCommand", () => {
    it("writes JSON + newline to subprocess stdin", () => {
      spawnRpc("sess-1", "/sessions/dir", "/project/cwd");
      const result = sendCommand("sess-1", { type: "get_state" });

      expect(result).toBe(true);
      expect(mockChild.stdin.write).toHaveBeenCalledWith('{"type":"get_state"}\n');
    });

    it("returns false for non-existent session", () => {
      const result = sendCommand("nonexistent", { type: "get_state" });
      expect(result).toBe(false);
    });
  });

  describe("onEvent / offEvent", () => {
    it("dispatches parsed JSON events from stdout to listeners", () => {
      spawnRpc("sess-1", "/sessions/dir", "/project/cwd");
      const listener = vi.fn();
      onEvent("sess-1", listener);

      // Emit on the readline mock created during spawnRpc
      mockReadlines[0].emit("line", '{"type":"state","model":"claude"}');

      expect(listener).toHaveBeenCalledWith({ type: "state", model: "claude" });
    });

    it("ignores empty lines", () => {
      spawnRpc("sess-1", "/sessions/dir", "/project/cwd");
      const listener = vi.fn();
      onEvent("sess-1", listener);

      mockReadlines[0].emit("line", "");
      mockReadlines[0].emit("line", "   ");

      expect(listener).not.toHaveBeenCalled();
    });

    it("ignores non-JSON lines", () => {
      spawnRpc("sess-1", "/sessions/dir", "/project/cwd");
      const listener = vi.fn();
      onEvent("sess-1", listener);

      mockReadlines[0].emit("line", "not json at all");

      expect(listener).not.toHaveBeenCalled();
    });

    it("removes listener with offEvent", () => {
      spawnRpc("sess-1", "/sessions/dir", "/project/cwd");
      const listener = vi.fn();
      onEvent("sess-1", listener);
      offEvent("sess-1", listener);

      mockReadlines[0].emit("line", '{"type":"state"}');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("subprocess lifecycle", () => {
    it("cleans up on subprocess exit and notifies listeners", () => {
      spawnRpc("sess-1", "/sessions/dir", "/project/cwd");
      const listener = vi.fn();
      onEvent("sess-1", listener);

      mockChild.emit("exit", 0, null);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: "rpc_exit", code: 0 })
      );
      expect(isConnected("sess-1")).toBe(false);
    });

    it("cleans up on subprocess error and notifies listeners", () => {
      spawnRpc("sess-1", "/sessions/dir", "/project/cwd");
      const listener = vi.fn();
      onEvent("sess-1", listener);

      mockChild.emit("error", new Error("spawn failed"));

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ type: "rpc_error", error: "spawn failed" })
      );
      expect(isConnected("sess-1")).toBe(false);
    });
  });

  describe("killRpc", () => {
    it("sends abort then SIGTERM", () => {
      spawnRpc("sess-1", "/sessions/dir", "/project/cwd");
      killRpc("sess-1");

      expect(mockChild.stdin.write).toHaveBeenCalledWith('{"type":"abort"}\n');

      vi.advanceTimersByTime(150);
      expect(mockChild.kill).toHaveBeenCalledWith("SIGTERM");
    });
  });

  describe("killAllRpc", () => {
    it("terminates all active subprocesses", () => {
      const child2 = createMockChild();
      mockSpawn.mockReturnValueOnce(mockChild).mockReturnValueOnce(child2);

      spawnRpc("sess-1", "/dir1", "/cwd1");
      spawnRpc("sess-2", "/dir2", "/cwd2");
      expect(getActiveCount()).toBe(2);

      killAllRpc();

      expect(mockChild.stdin.write).toHaveBeenCalledWith('{"type":"abort"}\n');
      expect(child2.stdin.write).toHaveBeenCalledWith('{"type":"abort"}\n');
    });
  });

  describe("idle timeout", () => {
    it("kills subprocess after idle timeout with no listeners", () => {
      spawnRpc("sess-1", "/sessions/dir", "/project/cwd");

      vi.advanceTimersByTime(10 * 60 * 1000);

      expect(mockChild.stdin.write).toHaveBeenCalledWith('{"type":"abort"}\n');
    });

    it("does not kill while listeners are attached", () => {
      spawnRpc("sess-1", "/sessions/dir", "/project/cwd");
      const listener = vi.fn();
      onEvent("sess-1", listener);

      vi.advanceTimersByTime(10 * 60 * 1000);

      expect(isConnected("sess-1")).toBe(true);
      expect(mockChild.kill).not.toHaveBeenCalled();
    });

    it("starts idle timer when last listener is removed", () => {
      spawnRpc("sess-1", "/sessions/dir", "/project/cwd");
      const listener = vi.fn();
      onEvent("sess-1", listener);
      offEvent("sess-1", listener);

      vi.advanceTimersByTime(10 * 60 * 1000);

      expect(mockChild.stdin.write).toHaveBeenCalledWith('{"type":"abort"}\n');
    });
  });
});
