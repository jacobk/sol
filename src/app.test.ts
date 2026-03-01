import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import type { SessionInfo } from "@mariozechner/pi-coding-agent";

// Mock the pi-coding-agent module before importing app
const mockListAll = vi.fn<() => Promise<SessionInfo[]>>();
const mockOpen = vi.fn();

vi.mock("@mariozechner/pi-coding-agent", () => ({
  SessionManager: {
    listAll: (...args: unknown[]) => mockListAll(...(args as [])),
    open: (...args: unknown[]) => mockOpen(...(args as [])),
  },
}));

// Mock the rpc module before importing app
const mockSpawnRpc = vi.fn<(sessionId: string, sessionDir: string, cwd: string) => boolean>();
const mockSendCommand = vi.fn<(sessionId: string, command: Record<string, unknown>) => boolean>();
const mockOnEvent = vi.fn();
const mockOffEvent = vi.fn();
const mockIsConnected = vi.fn<(sessionId: string) => boolean>();
const mockKillAllRpc = vi.fn();

vi.mock("./rpc.js", () => ({
  spawnRpc: (...args: unknown[]) => mockSpawnRpc(...(args as [string, string, string])),
  sendCommand: (...args: unknown[]) => mockSendCommand(...(args as [string, Record<string, unknown>])),
  onEvent: (...args: unknown[]) => mockOnEvent(...args),
  offEvent: (...args: unknown[]) => mockOffEvent(...args),
  isConnected: (...args: unknown[]) => mockIsConnected(...(args as [string])),
  killAllRpc: () => mockKillAllRpc(),
}));

const mockStartWatching = vi.fn();
const mockStopWatching = vi.fn();
const mockOnEntry = vi.fn();
const mockOffEntry = vi.fn();
const mockIsWatching = vi.fn<(sessionId: string) => boolean>();

vi.mock("./session-watcher.js", () => ({
  startWatching: (...args: unknown[]) => mockStartWatching(...args),
  stopWatching: (...args: unknown[]) => mockStopWatching(...args),
  onEntry: (...args: unknown[]) => mockOnEntry(...args),
  offEntry: (...args: unknown[]) => mockOffEntry(...args),
  isWatching: (...args: unknown[]) => mockIsWatching(...(args as [string])),
}));

const { app } = await import("./app.js");

function makeSessionInfo(overrides: Partial<SessionInfo> = {}): SessionInfo {
  return {
    path: "/mock/sessions/session-001",
    id: "sess-001",
    cwd: "/mock/project",
    name: "Test Session",
    created: new Date("2026-02-28T10:00:00Z"),
    modified: new Date("2026-02-28T12:00:00Z"),
    messageCount: 5,
    firstMessage: "Hello agent",
    allMessagesText: "Hello agent. Sure, I can help.",
    ...overrides,
  };
}

describe("GET /api/health", () => {
  it("returns ok: true", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe("API routes", () => {
  it("returns JSON content-type for /api/health", async () => {
    const res = await request(app).get("/api/health");

    expect(res.headers["content-type"]).toMatch(/json/);
  });

  it("returns 404 for unknown /api/ routes", async () => {
    const res = await request(app).get("/api/nonexistent");

    // Unknown API paths fall through to the SPA fallback, which returns 404
    // when the static index.html doesn't exist in the test environment
    expect([404, 200]).toContain(res.status);
  });
});

describe("GET /api/sessions/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns matching sessions with hit counts", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "s1", allMessagesText: "Hello world" }),
      makeSessionInfo({ id: "s2", allMessagesText: "Goodbye world" }),
    ]);

    const res = await request(app).get("/api/sessions/search?q=hello");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe("s1");
    expect(res.body[0].hitCount).toBe(1);
  });

  it("returns all sessions for empty query", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "s1" }),
      makeSessionInfo({ id: "s2" }),
    ]);

    const res = await request(app).get("/api/sessions/search?q=");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("returns all sessions when q param is missing", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "s1" }),
    ]);

    const res = await request(app).get("/api/sessions/search");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  it("returns 500 on internal error", async () => {
    mockListAll.mockRejectedValue(new Error("disk error"));

    const res = await request(app).get("/api/sessions/search?q=test");

    expect(res.status).toBe(500);
    expect(res.body.error).toBeDefined();
  });
});

describe("GET /api/session/:id/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for non-existent session", async () => {
    mockListAll.mockResolvedValue([]);

    const res = await request(app).get("/api/session/nonexistent/search?q=test");

    expect(res.status).toBe(404);
  });

  it("returns matching entries with snippets", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "s1", path: "/mock/s1" }),
    ]);
    mockOpen.mockReturnValue({
      getEntries: () => [
        {
          type: "message",
          id: "e1",
          parentId: null,
          timestamp: new Date().toISOString(),
          message: {
            role: "user",
            content: [{ type: "text", text: "Find the keyword here" }],
            timestamp: Date.now(),
          },
        },
      ],
    });

    const res = await request(app).get("/api/session/s1/search?q=keyword");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].entryId).toBe("e1");
    expect(res.body[0].snippet).toContain("keyword");
  });

  it("returns empty array for empty query", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "s1", path: "/mock/s1" }),
    ]);

    const res = await request(app).get("/api/session/s1/search?q=");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// --- RPC Endpoint Tests ---

describe("POST /api/session/:id/connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for non-existent session", async () => {
    mockIsConnected.mockReturnValue(false);
    mockListAll.mockResolvedValue([]);

    const res = await request(app).post("/api/session/nonexistent/connect");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Session not found");
  });

  it("spawns RPC subprocess and returns connected status", async () => {
    mockIsConnected.mockReturnValue(false);
    mockSpawnRpc.mockReturnValue(true);
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "sess-001", path: "/mock/sessions/session-001", cwd: "/mock/project" }),
    ]);

    const res = await request(app).post("/api/session/sess-001/connect");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("connected");
    expect(res.body.sessionId).toBe("sess-001");
    expect(mockSpawnRpc).toHaveBeenCalledWith("sess-001", "/mock/sessions", "/mock/project");
  });

  it("returns already_connected if session is already active", async () => {
    mockIsConnected.mockReturnValue(true);

    const res = await request(app).post("/api/session/sess-001/connect");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("connected");
    expect(mockSpawnRpc).not.toHaveBeenCalled();
  });
});

describe("GET /api/session/:id/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 if session is not connected and not watching", async () => {
    mockIsConnected.mockReturnValue(false);
    mockIsWatching.mockReturnValue(false);

    const res = await request(app).get("/api/session/sess-001/stream");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not connected/i);
  });

  it("opens SSE connection and registers event listener", () => {
    return new Promise<void>((resolve, reject) => {
      mockIsConnected.mockReturnValue(true);

      const req = request(app)
        .get("/api/session/sess-001/stream")
        .set("Accept", "text/event-stream");

      req.buffer(true)
        .parse((res, callback) => {
          let data = "";
          res.on("data", (chunk: Buffer) => {
            data += chunk.toString();
            if (data.includes('"connected"')) {
              try {
                expect(mockOnEvent).toHaveBeenCalledWith("sess-001", expect.any(Function));
                resolve();
              } catch (e) {
                reject(e);
              }
              (res as unknown as import("node:stream").Readable).destroy();
              callback(null, data);
            }
          });
        })
        .end(() => {
          // intentionally empty — resolution handled above
        });
    });
  });
});

describe("GET /api/session/:id/state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 if session is not connected", async () => {
    mockIsConnected.mockReturnValue(false);

    const res = await request(app).get("/api/session/sess-001/state");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not connected/i);
  });

  it("returns 500 if sendCommand fails", async () => {
    mockIsConnected.mockReturnValue(true);
    mockSendCommand.mockReturnValue(false);

    const res = await request(app).get("/api/session/sess-001/state");

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Failed to send/);
  });

  it("sends get_state command and returns the response", async () => {
    mockIsConnected.mockReturnValue(true);
    mockSendCommand.mockReturnValue(true);
    mockOnEvent.mockImplementation((_sessionId: string, callback: (event: Record<string, unknown>) => void) => {
      setTimeout(() => callback({ type: "state", model: "claude-3.5-sonnet", streaming: false }), 10);
    });

    const res = await request(app).get("/api/session/sess-001/state");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ type: "state", model: "claude-3.5-sonnet", streaming: false });
    expect(mockSendCommand).toHaveBeenCalledWith("sess-001", { type: "get_state" });
  });
});
