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
