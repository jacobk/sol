import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/** Parsed git status entry */
export interface GitFileStatus {
  path: string;
  status: "modified" | "added" | "untracked" | "deleted" | "renamed" | "copied";
}

/**
 * Parse `git status --porcelain` output into structured file list.
 * Returns null if the directory is not a git repo.
 */
export async function getGitStatus(cwd: string): Promise<GitFileStatus[] | null> {
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain"], {
      cwd,
      maxBuffer: 1024 * 1024,
    });

    const files: GitFileStatus[] = [];

    for (const line of stdout.split("\n")) {
      if (!line.trim()) continue;

      // Porcelain format: XY filename
      // X = index status, Y = working tree status
      const indexStatus = line[0];
      const workTreeStatus = line[1];
      const filePath = line.slice(3).trim();

      // Skip empty paths
      if (!filePath) continue;

      // Handle renamed files (format: "R  old -> new")
      const actualPath = filePath.includes(" -> ")
        ? filePath.split(" -> ")[1]
        : filePath;

      const status = mapGitStatus(indexStatus, workTreeStatus);
      if (status) {
        files.push({ path: actualPath, status });
      }
    }

    return files;
  } catch (err: unknown) {
    // Check if it's "not a git repository"
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not a git repository")) {
      return null;
    }
    throw err;
  }
}

function mapGitStatus(indexStatus: string, workTreeStatus: string): GitFileStatus["status"] | null {
  // Untracked
  if (indexStatus === "?" && workTreeStatus === "?") return "untracked";

  // Deleted (either in index or working tree)
  if (indexStatus === "D" || workTreeStatus === "D") return "deleted";

  // Added (new file in index)
  if (indexStatus === "A") return "added";

  // Renamed
  if (indexStatus === "R") return "renamed";

  // Copied
  if (indexStatus === "C") return "copied";

  // Modified (either in index or working tree)
  if (indexStatus === "M" || workTreeStatus === "M") return "modified";

  // Any other status with content — treat as modified
  if (indexStatus !== " " || workTreeStatus !== " ") return "modified";

  return null;
}

/**
 * Validate that a file path does not escape the cwd via directory traversal.
 * Returns the resolved absolute path if valid, or null if it escapes.
 */
export function validateFilePath(cwd: string, filePath: string): string | null {
  // Reject absolute paths and obvious traversal
  if (path.isAbsolute(filePath)) return null;

  const resolved = path.resolve(cwd, filePath);
  const normalizedCwd = path.resolve(cwd);

  // Ensure the resolved path starts with the cwd
  if (!resolved.startsWith(normalizedCwd + path.sep) && resolved !== normalizedCwd) {
    return null;
  }

  return resolved;
}

/**
 * Read file contents with path traversal protection.
 * Returns the file content as a string, or null if path is invalid.
 * Throws on actual read errors (file not found, permissions, etc.).
 */
export async function getFileContent(cwd: string, filePath: string): Promise<string | null> {
  const resolved = validateFilePath(cwd, filePath);
  if (!resolved) return null;

  const content = await readFile(resolved, "utf-8");
  return content;
}

/**
 * Get all git-tracked files in the repository.
 * Returns a flat list of file paths relative to cwd.
 * Returns null if the directory is not a git repo.
 */
export async function getGitTrackedFiles(cwd: string): Promise<string[] | null> {
  try {
    const { stdout } = await execFileAsync("git", ["ls-files"], {
      cwd,
      maxBuffer: 5 * 1024 * 1024, // 5MB buffer for large repos
    });

    const files = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return files;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not a git repository")) {
      return null;
    }
    throw err;
  }
}

/**
 * Get git diff for a specific file.
 * Returns raw diff text. Returns empty string if file has no diff (e.g. untracked).
 * Returns null if the directory is not a git repo.
 */
export async function getGitDiff(cwd: string, filePath: string): Promise<string | null> {
  const validated = validateFilePath(cwd, filePath);
  if (!validated) return null;

  try {
    // Try staged diff first, then unstaged
    const { stdout: stagedDiff } = await execFileAsync(
      "git",
      ["diff", "--cached", "--", filePath],
      { cwd, maxBuffer: 5 * 1024 * 1024 }
    );

    const { stdout: unstagedDiff } = await execFileAsync(
      "git",
      ["diff", "--", filePath],
      { cwd, maxBuffer: 5 * 1024 * 1024 }
    );

    // Combine: prefer showing both staged and unstaged changes
    const combined = (stagedDiff + unstagedDiff).trim();

    // For untracked/newly added files with no diff output, generate a pseudo-diff
    if (!combined) {
      try {
        const { stdout: diffNewFile } = await execFileAsync(
          "git",
          ["diff", "--no-index", "/dev/null", filePath],
          { cwd, maxBuffer: 5 * 1024 * 1024 }
        );
        return diffNewFile;
      } catch (diffErr: unknown) {
        // git diff --no-index returns exit code 1 when files differ (which they always will)
        if (diffErr && typeof diffErr === "object" && "stdout" in diffErr) {
          return (diffErr as { stdout: string }).stdout || "";
        }
        return "";
      }
    }

    return combined;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not a git repository")) {
      return null;
    }
    throw err;
  }
}
