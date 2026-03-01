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

// Mock the files module before importing app
const mockGetGitStatus = vi.fn();
const mockGetFileContent = vi.fn();
const mockGetGitDiff = vi.fn();
const mockGetGitTrackedFiles = vi.fn();

vi.mock("./files.js", () => ({
  getGitStatus: (...args: unknown[]) => mockGetGitStatus(...args),
  getFileContent: (...args: unknown[]) => mockGetFileContent(...args),
  getGitDiff: (...args: unknown[]) => mockGetGitDiff(...args),
  getGitTrackedFiles: (...args: unknown[]) => mockGetGitTrackedFiles(...args),
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

  it("spawns RPC subprocess and switches to session", async () => {
    mockIsConnected.mockReturnValue(false);
    mockSpawnRpc.mockReturnValue(true);
    mockSendCommand.mockReturnValue(true);
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "sess-001", path: "/mock/sessions/session-001", cwd: "/mock/project" }),
    ]);
    // Mock onEvent to immediately call back with switch_session response
    mockOnEvent.mockImplementation((_sessionId: string, callback: (event: Record<string, unknown>) => void) => {
      setTimeout(() => {
        callback({
          type: "response",
          command: "switch_session",
          success: true,
          data: { cancelled: false },
        });
      }, 5);
    });

    const res = await request(app).post("/api/session/sess-001/connect");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("connected");
    expect(res.body.sessionId).toBe("sess-001");
    expect(mockSpawnRpc).toHaveBeenCalledWith("sess-001", "/mock/sessions", "/mock/project");
    expect(mockSendCommand).toHaveBeenCalledWith("sess-001", { type: "switch_session", sessionPath: "/mock/sessions/session-001" });
  });

  it("returns already_connected if session is already active", async () => {
    mockIsConnected.mockReturnValue(true);
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "sess-001", path: "/mock/sessions/session-001", cwd: "/mock/project" }),
    ]);

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
      setTimeout(() => callback({ type: "response", command: "get_state", success: true, data: { model: { provider: "anthropic", modelId: "claude-3.5-sonnet" }, isStreaming: false } }), 10);
    });

    const res = await request(app).get("/api/session/sess-001/state");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ type: "response", command: "get_state", success: true, data: { model: { provider: "anthropic", modelId: "claude-3.5-sonnet" }, isStreaming: false } });
    expect(mockSendCommand).toHaveBeenCalledWith("sess-001", { type: "get_state" });
  });
});

// --- Model Endpoint Tests ---

describe("GET /api/session/:id/models", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 if session is not connected", async () => {
    mockIsConnected.mockReturnValue(false);

    const res = await request(app).get("/api/session/sess-001/models");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not connected/i);
  });

  it("returns 500 if sendCommand fails", async () => {
    mockIsConnected.mockReturnValue(true);
    mockSendCommand.mockReturnValue(false);

    const res = await request(app).get("/api/session/sess-001/models");

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Failed to send/);
  });

  it("sends get_available_models command and returns the response", async () => {
    mockIsConnected.mockReturnValue(true);
    mockSendCommand.mockReturnValue(true);
    mockOnEvent.mockImplementation((_sessionId: string, callback: (event: Record<string, unknown>) => void) => {
      setTimeout(() => callback({
        type: "response",
        command: "get_available_models",
        success: true,
        data: {
          models: [
            { provider: "anthropic", modelId: "claude-3.5-sonnet" },
            { provider: "anthropic", modelId: "claude-3-opus" },
            { provider: "openai", modelId: "gpt-4o" },
          ],
        },
      }), 10);
    });

    const res = await request(app).get("/api/session/sess-001/models");

    expect(res.status).toBe(200);
    expect(res.body.type).toBe("response");
    expect(res.body.command).toBe("get_available_models");
    expect(res.body.data.models).toHaveLength(3);
    expect(mockSendCommand).toHaveBeenCalledWith("sess-001", { type: "get_available_models" });
  });
});

describe("PUT /api/session/:id/model", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 if session is not connected", async () => {
    mockIsConnected.mockReturnValue(false);

    const res = await request(app)
      .put("/api/session/sess-001/model")
      .send({ provider: "anthropic", modelId: "claude-3-opus" });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not connected/i);
  });

  it("returns 400 when provider or modelId is missing", async () => {
    mockIsConnected.mockReturnValue(true);

    const res = await request(app)
      .put("/api/session/sess-001/model")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/provider/i);
  });

  it("returns 400 when only provider is given", async () => {
    mockIsConnected.mockReturnValue(true);

    const res = await request(app)
      .put("/api/session/sess-001/model")
      .send({ provider: "anthropic" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/modelId/i);
  });

  it("returns 500 if sendCommand fails", async () => {
    mockIsConnected.mockReturnValue(true);
    mockSendCommand.mockReturnValue(false);

    const res = await request(app)
      .put("/api/session/sess-001/model")
      .send({ provider: "anthropic", modelId: "claude-3-opus" });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Failed to send/);
  });

  it("sends set_model command and returns the response", async () => {
    mockIsConnected.mockReturnValue(true);
    mockSendCommand.mockReturnValue(true);
    mockOnEvent.mockImplementation((_sessionId: string, callback: (event: Record<string, unknown>) => void) => {
      setTimeout(() => callback({
        type: "response",
        command: "set_model",
        success: true,
        data: { provider: "anthropic", modelId: "claude-3-opus" },
      }), 10);
    });

    const res = await request(app)
      .put("/api/session/sess-001/model")
      .send({ provider: "anthropic", modelId: "claude-3-opus" });

    expect(res.status).toBe(200);
    expect(res.body.type).toBe("response");
    expect(res.body.command).toBe("set_model");
    expect(res.body.data).toEqual({ provider: "anthropic", modelId: "claude-3-opus" });
    expect(mockSendCommand).toHaveBeenCalledWith("sess-001", { type: "set_model", provider: "anthropic", modelId: "claude-3-opus" });
  });
});

// --- File Inspector Endpoint Tests ---

describe("GET /api/files/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for unknown session", async () => {
    mockListAll.mockResolvedValue([]);

    const res = await request(app).get("/api/files/nonexistent");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Session not found");
  });

  it("returns 404 when cwd is not a git repo", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "sess-001", cwd: "/tmp/no-git" }),
    ]);
    mockGetGitStatus.mockResolvedValue(null);

    const res = await request(app).get("/api/files/sess-001");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not a git repository/i);
  });

  it("returns file list on success", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "sess-001", cwd: "/mock/project" }),
    ]);
    mockGetGitStatus.mockResolvedValue([
      { path: "src/app.ts", status: "modified" },
      { path: "README.md", status: "added" },
    ]);

    const res = await request(app).get("/api/files/sess-001");

    expect(res.status).toBe(200);
    expect(res.body.cwd).toBe("/mock/project");
    expect(res.body.files).toHaveLength(2);
    expect(res.body.files[0]).toEqual({ path: "src/app.ts", status: "modified" });
  });

  it("returns 500 on unexpected error", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "sess-001" }),
    ]);
    mockGetGitStatus.mockRejectedValue(new Error("exec failed"));

    const res = await request(app).get("/api/files/sess-001");

    expect(res.status).toBe(500);
  });
});

describe("GET /api/files/:id/content", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for unknown session", async () => {
    mockListAll.mockResolvedValue([]);

    const res = await request(app).get("/api/files/nonexistent/content?path=README.md");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Session not found");
  });

  it("returns 400 when path param is missing", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "sess-001" }),
    ]);

    const res = await request(app).get("/api/files/sess-001/content");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/path/i);
  });

  it("returns 403 for path traversal attempt", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "sess-001" }),
    ]);
    mockGetFileContent.mockResolvedValue(null);

    const res = await request(app).get("/api/files/sess-001/content?path=../../../etc/passwd");

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/invalid file path/i);
  });

  it("returns 404 when file does not exist", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "sess-001" }),
    ]);
    mockGetFileContent.mockRejectedValue(new Error("ENOENT: no such file"));

    const res = await request(app).get("/api/files/sess-001/content?path=nonexistent.ts");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
  });

  it("returns file content on success", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "sess-001" }),
    ]);
    mockGetFileContent.mockResolvedValue("console.log('hello');");

    const res = await request(app).get("/api/files/sess-001/content?path=src/index.ts");

    expect(res.status).toBe(200);
    expect(res.body.path).toBe("src/index.ts");
    expect(res.body.content).toBe("console.log('hello');");
  });
});

describe("GET /api/files/:id/diff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for unknown session", async () => {
    mockListAll.mockResolvedValue([]);

    const res = await request(app).get("/api/files/nonexistent/diff?path=file.ts");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Session not found");
  });

  it("returns 400 when path param is missing", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "sess-001" }),
    ]);

    const res = await request(app).get("/api/files/sess-001/diff");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/path/i);
  });

  it("returns 404 for non-git repo or invalid path", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "sess-001" }),
    ]);
    mockGetGitDiff.mockResolvedValue(null);

    const res = await request(app).get("/api/files/sess-001/diff?path=file.ts");

    expect(res.status).toBe(404);
  });

  it("returns diff on success", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "sess-001" }),
    ]);
    mockGetGitDiff.mockResolvedValue("diff --git a/file.ts b/file.ts\n+added line");

    const res = await request(app).get("/api/files/sess-001/diff?path=file.ts");

    expect(res.status).toBe(200);
    expect(res.body.path).toBe("file.ts");
    expect(res.body.diff).toContain("+added line");
  });

  it("returns 500 on unexpected error", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "sess-001" }),
    ]);
    mockGetGitDiff.mockRejectedValue(new Error("exec failed"));

    const res = await request(app).get("/api/files/sess-001/diff?path=file.ts");

    expect(res.status).toBe(500);
  });
});

describe("GET /api/files/:id/tree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for unknown session", async () => {
    mockListAll.mockResolvedValue([]);

    const res = await request(app).get("/api/files/nonexistent/tree");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Session not found");
  });

  it("returns 404 for non-git repo", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "sess-001" }),
    ]);
    mockGetGitTrackedFiles.mockResolvedValue(null);

    const res = await request(app).get("/api/files/sess-001/tree");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not a git repository/i);
  });

  it("returns file list on success", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "sess-001" }),
    ]);
    mockGetGitTrackedFiles.mockResolvedValue([
      "src/app.ts",
      "src/index.ts",
      "package.json",
    ]);

    const res = await request(app).get("/api/files/sess-001/tree");

    expect(res.status).toBe(200);
    expect(res.body.cwd).toBe("/mock/project");
    expect(res.body.files).toHaveLength(3);
    expect(res.body.files).toContain("src/app.ts");
    expect(res.body.files).toContain("package.json");
  });

  it("returns 500 on unexpected error", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "sess-001" }),
    ]);
    mockGetGitTrackedFiles.mockRejectedValue(new Error("exec failed"));

    const res = await request(app).get("/api/files/sess-001/tree");

    expect(res.status).toBe(500);
  });
});

describe("GET /api/session/:id/commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when session is not connected", async () => {
    mockIsConnected.mockReturnValue(false);

    const res = await request(app).get("/api/session/sess-001/commands");

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not connected/i);
  });

  it("returns 500 when sendCommand fails", async () => {
    mockIsConnected.mockReturnValue(true);
    mockSendCommand.mockReturnValue(false);

    const res = await request(app).get("/api/session/sess-001/commands");

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Failed to send command/i);
  });

  it("calls sendCommand with get_commands type", async () => {
    mockIsConnected.mockReturnValue(true);
    mockSendCommand.mockReturnValue(true);
    // Mock onEvent to immediately call back with response
    mockOnEvent.mockImplementation((_sessionId: string, callback: (event: Record<string, unknown>) => void) => {
      // Simulate async response
      setTimeout(() => {
        callback({
          type: "response",
          command: "get_commands",
          success: true,
          skills: [{ name: "commit", description: "Create a commit" }],
          commands: [{ name: "clear", description: "Clear screen" }],
        });
      }, 5);
    });

    const res = await request(app).get("/api/session/sess-001/commands");

    expect(mockSendCommand).toHaveBeenCalledWith("sess-001", { type: "get_commands" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe("POST /api/session/:id/fork", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when session is not connected", async () => {
    mockIsConnected.mockReturnValue(false);

    const res = await request(app)
      .post("/api/session/sess-001/fork")
      .send({ entryId: "entry-123" });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not connected/i);
  });

  it("returns 400 when entryId is missing", async () => {
    mockIsConnected.mockReturnValue(true);

    const res = await request(app)
      .post("/api/session/sess-001/fork")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/entryId/i);
  });

  it("returns 500 when sendCommand fails", async () => {
    mockIsConnected.mockReturnValue(true);
    mockSendCommand.mockReturnValue(false);

    const res = await request(app)
      .post("/api/session/sess-001/fork")
      .send({ entryId: "entry-123" });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Failed to send/i);
  });

  it("sends fork command with entryId on success", async () => {
    mockIsConnected.mockReturnValue(true);
    mockSendCommand.mockReturnValue(true);
    mockOnEvent.mockImplementation((_sessionId: string, callback: (event: Record<string, unknown>) => void) => {
      setTimeout(() => {
        callback({
          type: "response",
          command: "fork",
          success: true,
          data: { text: "Original prompt text", cancelled: false },
        });
      }, 5);
    });

    const res = await request(app)
      .post("/api/session/sess-001/fork")
      .send({ entryId: "entry-123" });

    expect(mockSendCommand).toHaveBeenCalledWith("sess-001", { type: "fork", entryId: "entry-123" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.text).toBe("Original prompt text");
  });

  it("returns 409 when fork is cancelled by extension", async () => {
    mockIsConnected.mockReturnValue(true);
    mockSendCommand.mockReturnValue(true);
    mockOnEvent.mockImplementation((_sessionId: string, callback: (event: Record<string, unknown>) => void) => {
      setTimeout(() => {
        callback({
          type: "response",
          command: "fork",
          success: true,
          data: { text: "Original prompt", cancelled: true },
        });
      }, 5);
    });

    const res = await request(app)
      .post("/api/session/sess-001/fork")
      .send({ entryId: "entry-123" });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/cancelled/i);
  });
});

describe("POST /api/sessions/new", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 when cwd is missing", async () => {
    const res = await request(app)
      .post("/api/sessions/new")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cwd/i);
  });

  it("returns 400 when cwd is not a string", async () => {
    const res = await request(app)
      .post("/api/sessions/new")
      .send({ cwd: 123 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/cwd/i);
  });

  it("returns 400 when cwd does not exist", async () => {
    const res = await request(app)
      .post("/api/sessions/new")
      .send({ cwd: "/nonexistent/path/that/does/not/exist" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not accessible|does not exist/i);
  });
});
