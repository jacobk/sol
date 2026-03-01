import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SessionInfo, SessionEntry } from "@mariozechner/pi-coding-agent";

// Mock the pi-coding-agent module
const mockListAll = vi.fn<() => Promise<SessionInfo[]>>();
const mockOpen = vi.fn();

vi.mock("@mariozechner/pi-coding-agent", () => ({
  SessionManager: {
    listAll: (...args: unknown[]) => mockListAll(...(args as [])),
    open: (...args: unknown[]) => mockOpen(...(args as [])),
  },
}));

// Import after mocking
const { searchSessions, searchSessionEntries } = await import("./sessions.js");

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
    allMessagesText: "Hello agent. Sure, I can help with that. Let me write some code.",
    ...overrides,
  };
}

function makeMessageEntry(id: string, text: string): SessionEntry {
  return {
    type: "message",
    id,
    parentId: null,
    timestamp: new Date().toISOString(),
    message: {
      role: "user",
      content: [{ type: "text", text }],
      timestamp: Date.now(),
    },
  } as SessionEntry;
}

describe("searchSessions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns matching sessions with hit count for a query", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "s1", allMessagesText: "Hello world. Hello again." }),
      makeSessionInfo({ id: "s2", allMessagesText: "No match here." }),
      makeSessionInfo({ id: "s3", allMessagesText: "Say hello to everyone." }),
    ]);

    const results = await searchSessions("hello");

    expect(results).toHaveLength(2);
    expect(results[0].id).toBe("s1");
    expect(results[0].hitCount).toBe(2);
    expect(results[1].id).toBe("s3");
    expect(results[1].hitCount).toBe(1);
  });

  it("is case-insensitive", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "s1", allMessagesText: "Hello HELLO hElLo" }),
    ]);

    const results = await searchSessions("hello");

    expect(results).toHaveLength(1);
    expect(results[0].hitCount).toBe(3);
  });

  it("returns all sessions with hitCount 0 for empty query", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "s1" }),
      makeSessionInfo({ id: "s2" }),
    ]);

    const results = await searchSessions("");

    expect(results).toHaveLength(2);
    expect(results[0].hitCount).toBe(0);
    expect(results[1].hitCount).toBe(0);
  });

  it("returns all sessions with hitCount 0 for whitespace-only query", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "s1" }),
    ]);

    const results = await searchSessions("   ");

    expect(results).toHaveLength(1);
    expect(results[0].hitCount).toBe(0);
  });

  it("returns empty array when no sessions match", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "s1", allMessagesText: "nothing relevant" }),
    ]);

    const results = await searchSessions("xyz123");

    expect(results).toHaveLength(0);
  });

  it("includes correct session metadata in results", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({
        id: "s1",
        cwd: "/projects/myapp",
        name: "My Session",
        messageCount: 10,
        firstMessage: "Start here",
        allMessagesText: "findme in this session",
      }),
    ]);

    const results = await searchSessions("findme");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: "s1",
      cwd: "/projects/myapp",
      name: "My Session",
      messageCount: 10,
      firstMessage: "Start here",
      hitCount: 1,
    });
  });
});

describe("searchSessionEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for non-existent session", async () => {
    mockListAll.mockResolvedValue([]);

    const result = await searchSessionEntries("nonexistent", "test");

    expect(result).toBeNull();
  });

  it("returns empty array for empty query", async () => {
    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "s1" }),
    ]);

    const result = await searchSessionEntries("s1", "");

    expect(result).toEqual([]);
  });

  it("returns matching entry IDs with context snippets", async () => {
    const entries = [
      makeMessageEntry("e1", "This is a test message with searchable content"),
      makeMessageEntry("e2", "No match here"),
      makeMessageEntry("e3", "Another test entry to find"),
    ];

    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "s1", path: "/mock/s1" }),
    ]);
    mockOpen.mockReturnValue({
      getEntries: () => entries,
    });

    const result = await searchSessionEntries("s1", "test");

    expect(result).not.toBeNull();
    expect(result).toHaveLength(2);
    expect(result![0].entryId).toBe("e1");
    expect(result![0].snippet).toContain("test");
    expect(result![1].entryId).toBe("e3");
    expect(result![1].snippet).toContain("test");
  });

  it("search within entries is case-insensitive", async () => {
    const entries = [
      makeMessageEntry("e1", "This has a TEST match"),
    ];

    mockListAll.mockResolvedValue([
      makeSessionInfo({ id: "s1", path: "/mock/s1" }),
    ]);
    mockOpen.mockReturnValue({
      getEntries: () => entries,
    });

    const result = await searchSessionEntries("s1", "test");

    expect(result).toHaveLength(1);
    expect(result![0].entryId).toBe("e1");
  });
});
