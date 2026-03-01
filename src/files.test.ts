import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";

// Mock child_process.execFile
const mockExecFile = vi.fn();
vi.mock("node:child_process", () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args),
}));

// Mock fs/promises.readFile
const mockReadFile = vi.fn();
vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

// Mock util.promisify to return our mockExecFile as an async function
vi.mock("node:util", () => ({
  promisify: () => mockExecFile,
}));

const { getGitStatus, getFileContent, getGitDiff, getGitTrackedFiles, validateFilePath } = await import("./files.js");

describe("validateFilePath", () => {
  const cwd = "/projects/myapp";

  it("accepts a simple relative path", () => {
    const result = validateFilePath(cwd, "src/index.ts");
    expect(result).toBe(path.resolve(cwd, "src/index.ts"));
  });

  it("accepts a file in the root of cwd", () => {
    const result = validateFilePath(cwd, "README.md");
    expect(result).toBe(path.resolve(cwd, "README.md"));
  });

  it("rejects absolute paths", () => {
    expect(validateFilePath(cwd, "/etc/passwd")).toBeNull();
  });

  it("rejects directory traversal with ../", () => {
    expect(validateFilePath(cwd, "../other-project/secret.ts")).toBeNull();
  });

  it("rejects nested directory traversal", () => {
    expect(validateFilePath(cwd, "src/../../other/file.ts")).toBeNull();
  });

  it("rejects traversal that resolves outside cwd even with valid-looking prefix", () => {
    expect(validateFilePath(cwd, "src/../../../etc/passwd")).toBeNull();
  });

  it("accepts paths with .. that still resolve within cwd", () => {
    const result = validateFilePath(cwd, "src/../README.md");
    expect(result).toBe(path.resolve(cwd, "README.md"));
  });
});

describe("getGitStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("parses modified files", async () => {
    mockExecFile.mockResolvedValue({ stdout: " M src/app.ts\n", stderr: "" });

    const result = await getGitStatus("/projects/myapp");

    expect(result).toEqual([{ path: "src/app.ts", status: "modified" }]);
  });

  it("parses added files", async () => {
    mockExecFile.mockResolvedValue({ stdout: "A  src/new.ts\n", stderr: "" });

    const result = await getGitStatus("/projects/myapp");

    expect(result).toEqual([{ path: "src/new.ts", status: "added" }]);
  });

  it("parses untracked files", async () => {
    mockExecFile.mockResolvedValue({ stdout: "?? temp.log\n", stderr: "" });

    const result = await getGitStatus("/projects/myapp");

    expect(result).toEqual([{ path: "temp.log", status: "untracked" }]);
  });

  it("parses deleted files", async () => {
    mockExecFile.mockResolvedValue({ stdout: " D old-file.ts\n", stderr: "" });

    const result = await getGitStatus("/projects/myapp");

    expect(result).toEqual([{ path: "old-file.ts", status: "deleted" }]);
  });

  it("parses renamed files (uses new path)", async () => {
    mockExecFile.mockResolvedValue({ stdout: "R  old.ts -> new.ts\n", stderr: "" });

    const result = await getGitStatus("/projects/myapp");

    expect(result).toEqual([{ path: "new.ts", status: "renamed" }]);
  });

  it("parses multiple files with mixed statuses", async () => {
    mockExecFile.mockResolvedValue({
      stdout: " M src/app.ts\nA  src/new.ts\n?? temp.log\n D removed.ts\n",
      stderr: "",
    });

    const result = await getGitStatus("/projects/myapp");

    expect(result).toHaveLength(4);
    expect(result).toEqual([
      { path: "src/app.ts", status: "modified" },
      { path: "src/new.ts", status: "added" },
      { path: "temp.log", status: "untracked" },
      { path: "removed.ts", status: "deleted" },
    ]);
  });

  it("returns empty array for clean working tree", async () => {
    mockExecFile.mockResolvedValue({ stdout: "", stderr: "" });

    const result = await getGitStatus("/projects/myapp");

    expect(result).toEqual([]);
  });

  it("returns null for non-git directory", async () => {
    mockExecFile.mockRejectedValue(new Error("fatal: not a git repository"));

    const result = await getGitStatus("/tmp/not-a-repo");

    expect(result).toBeNull();
  });

  it("rethrows unexpected errors", async () => {
    mockExecFile.mockRejectedValue(new Error("permission denied"));

    await expect(getGitStatus("/projects/myapp")).rejects.toThrow("permission denied");
  });
});

describe("getFileContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads file content for valid path", async () => {
    mockReadFile.mockResolvedValue("console.log('hello');");

    const result = await getFileContent("/projects/myapp", "src/index.ts");

    expect(result).toBe("console.log('hello');");
    expect(mockReadFile).toHaveBeenCalledWith(
      path.resolve("/projects/myapp", "src/index.ts"),
      "utf-8"
    );
  });

  it("returns null for path traversal attempt", async () => {
    const result = await getFileContent("/projects/myapp", "../../../etc/passwd");

    expect(result).toBeNull();
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it("returns null for absolute path", async () => {
    const result = await getFileContent("/projects/myapp", "/etc/passwd");

    expect(result).toBeNull();
    expect(mockReadFile).not.toHaveBeenCalled();
  });

  it("propagates read errors (e.g. ENOENT)", async () => {
    mockReadFile.mockRejectedValue(new Error("ENOENT: no such file"));

    await expect(getFileContent("/projects/myapp", "nonexistent.ts")).rejects.toThrow("ENOENT");
  });
});

describe("getGitDiff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns combined staged and unstaged diff", async () => {
    // First call: staged diff, second call: unstaged diff
    mockExecFile
      .mockResolvedValueOnce({ stdout: "staged diff\n", stderr: "" })
      .mockResolvedValueOnce({ stdout: "unstaged diff\n", stderr: "" });

    const result = await getGitDiff("/projects/myapp", "src/app.ts");

    expect(result).toBe("staged diff\nunstaged diff");
  });

  it("returns only unstaged diff when no staged changes", async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: "", stderr: "" })
      .mockResolvedValueOnce({ stdout: "unstaged diff content\n", stderr: "" });

    const result = await getGitDiff("/projects/myapp", "src/app.ts");

    expect(result).toBe("unstaged diff content");
  });

  it("falls back to --no-index for new/untracked files with no diff", async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: "", stderr: "" })  // staged: empty
      .mockResolvedValueOnce({ stdout: "", stderr: "" })  // unstaged: empty
      .mockRejectedValueOnce({ stdout: "new file diff\n", stderr: "", code: 1 }); // --no-index exits 1

    const result = await getGitDiff("/projects/myapp", "newfile.ts");

    expect(result).toBe("new file diff\n");
  });

  it("returns null for non-git directory", async () => {
    mockExecFile.mockRejectedValue(new Error("fatal: not a git repository"));

    const result = await getGitDiff("/projects/myapp", "file.ts");

    expect(result).toBeNull();
  });

  it("returns null for path traversal attempt", async () => {
    const result = await getGitDiff("/projects/myapp", "../../../etc/passwd");

    expect(result).toBeNull();
    expect(mockExecFile).not.toHaveBeenCalled();
  });
});

describe("getGitTrackedFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns list of tracked files", async () => {
    mockExecFile.mockResolvedValue({
      stdout: "src/app.ts\nsrc/index.ts\npackage.json\n",
      stderr: "",
    });

    const result = await getGitTrackedFiles("/projects/myapp");

    expect(result).toEqual(["src/app.ts", "src/index.ts", "package.json"]);
  });

  it("handles empty repository", async () => {
    mockExecFile.mockResolvedValue({ stdout: "", stderr: "" });

    const result = await getGitTrackedFiles("/projects/myapp");

    expect(result).toEqual([]);
  });

  it("trims whitespace from file paths", async () => {
    mockExecFile.mockResolvedValue({
      stdout: "  src/app.ts  \n  README.md  \n",
      stderr: "",
    });

    const result = await getGitTrackedFiles("/projects/myapp");

    expect(result).toEqual(["src/app.ts", "README.md"]);
  });

  it("returns null for non-git directory", async () => {
    mockExecFile.mockRejectedValue(new Error("fatal: not a git repository"));

    const result = await getGitTrackedFiles("/tmp/not-a-repo");

    expect(result).toBeNull();
  });

  it("rethrows unexpected errors", async () => {
    mockExecFile.mockRejectedValue(new Error("permission denied"));

    await expect(getGitTrackedFiles("/projects/myapp")).rejects.toThrow("permission denied");
  });
});
