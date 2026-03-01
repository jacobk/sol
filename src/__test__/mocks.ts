import { vi } from "vitest";

/**
 * Creates a mock SessionManager instance with default stub implementations.
 * Override individual methods as needed in tests.
 */
export function createMockSessionManager() {
  return {
    getEntries: vi.fn().mockReturnValue([]),
    getTree: vi.fn().mockReturnValue([]),
    getBranch: vi.fn().mockReturnValue([]),
    getHeader: vi.fn().mockReturnValue(null),
    getLeafId: vi.fn().mockReturnValue(null),
    getChildren: vi.fn().mockReturnValue([]),
  };
}

/**
 * Creates a mock SessionInfo object as returned by SessionManager.listAll().
 */
export function createMockSessionInfo(overrides: Record<string, unknown> = {}) {
  return {
    path: "/mock/sessions/session-001",
    cwd: "/mock/project",
    name: "mock-session",
    messageCount: 5,
    createdAt: new Date("2026-02-28T10:00:00Z"),
    modifiedAt: new Date("2026-02-28T12:00:00Z"),
    firstMessagePreview: "Hello, agent",
    allMessagesText: "Hello, agent. Sure, I can help with that.",
    ...overrides,
  };
}

/**
 * Creates a mock RPC subprocess with piped stdin/stdout/stderr.
 */
export function createMockRpcProcess() {
  return {
    stdin: { write: vi.fn(), end: vi.fn() },
    stdout: { on: vi.fn(), pipe: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn(),
    kill: vi.fn(),
    pid: 12345,
  };
}
