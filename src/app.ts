import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listGroupedSessions, getSessionById, getSessionTree, getSessionBranch, searchSessions, searchSessionEntries, findSessionById } from "./sessions.js";
import { spawnRpc, sendCommand, onEvent, offEvent, isConnected, killAllRpc, rekeyRpc, type RpcEventCallback } from "./rpc.js";
import { startWatching, onEntry, offEntry, isWatching, stopAllWatchers, type SessionEntryCallback } from "./session-watcher.js";
import { getGitStatus, getFileContent, getGitDiff, getGitTrackedFiles } from "./files.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const app = express();

app.use(express.json());

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Session list endpoint
app.get("/api/sessions", async (_req, res) => {
  try {
    const groups = await listGroupedSessions();
    res.json(groups);
  } catch (err) {
    console.error("Failed to list sessions:", err);
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

// Search across all sessions
app.get("/api/sessions/search", async (req, res) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const results = await searchSessions(query);
    res.json(results);
  } catch (err) {
    console.error("Failed to search sessions:", err);
    res.status(500).json({ error: "Failed to search sessions" });
  }
});

// Search within a specific session
app.get("/api/session/:id/search", async (req, res) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q : "";
    const result = await searchSessionEntries(req.params.id, query);
    if (result === null) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(result);
  } catch (err) {
    console.error("Failed to search session entries:", err);
    res.status(500).json({ error: "Failed to search session entries" });
  }
});

// Session detail endpoint
app.get("/api/session/:id", async (req, res) => {
  try {
    const leafId = typeof req.query.leafId === "string" ? req.query.leafId : undefined;
    const result = leafId
      ? await getSessionBranch(req.params.id, leafId)
      : await getSessionById(req.params.id);
    if (!result) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(result);
  } catch (err) {
    console.error("Failed to get session:", err);
    res.status(500).json({ error: "Failed to get session" });
  }
});

// Tree structure endpoint
app.get("/api/tree/:id", async (req, res) => {
  try {
    const result = await getSessionTree(req.params.id);
    if (!result) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(result);
  } catch (err) {
    console.error("Failed to get session tree:", err);
    res.status(500).json({ error: "Failed to get session tree" });
  }
});

// --- Active Session (RPC) Endpoints ---

// Connect to a session — spawn RPC subprocess AND start file watcher
app.post("/api/session/:id/connect", async (req, res) => {
  try {
    const sessionId = req.params.id;

    // Look up session to get path and cwd
    const session = await findSessionById(sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    // Start file watcher (always, for monitoring)
    startWatching(sessionId, session.path);

    // Spawn RPC subprocess (for sending prompts/steer/abort)
    const wasAlreadyConnected = isConnected(sessionId);
    if (!wasAlreadyConnected) {
      spawnRpc(sessionId, path.dirname(session.path), session.cwd);

      // Send switch_session to load the existing session file
      // Pi spawns with a new session by default, so we need to load the historical one
      console.log(`[connect] Switching to session file: ${session.path}`);
      
      const switchPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          offEvent(sessionId, listener);
          reject(new Error("Timeout waiting for switch_session response"));
        }, 10_000);

        const listener: RpcEventCallback = (event) => {
          if (event.type === "response" && event.command === "switch_session") {
            clearTimeout(timeout);
            offEvent(sessionId, listener);
            if (event.success === false) {
              reject(new Error((event.error as string) || "Failed to switch session"));
              return;
            }
            const data = event.data as { cancelled?: boolean } | undefined;
            if (data?.cancelled) {
              reject(new Error("Session switch was cancelled by an extension"));
              return;
            }
            console.log(`[connect] Successfully switched to session`);
            resolve();
            return;
          }
          // Also handle parse errors
          if (event.type === "response" && event.command === "parse" && event.success === false) {
            clearTimeout(timeout);
            offEvent(sessionId, listener);
            reject(new Error((event.error as string) || "Failed to parse switch_session command"));
            return;
          }
        };

        onEvent(sessionId, listener);
        const sent = sendCommand(sessionId, { type: "switch_session", sessionPath: session.path });
        if (!sent) {
          clearTimeout(timeout);
          offEvent(sessionId, listener);
          reject(new Error("Failed to send switch_session command"));
        }
      });

      await switchPromise;
    }

    res.json({ status: "connected", sessionId });
  } catch (err) {
    console.error("Failed to connect to session:", err);
    res.status(500).json({ error: err instanceof Error ? err.message : "Failed to connect to session" });
  }
});

// Stream session events via SSE.
// Merges two sources:
// 1. File watcher — new entries appended to the JSONL file by ANY pi process
// 2. RPC events — streaming deltas, tool execution from Sol's own subprocess
app.get("/api/session/:id/stream", (req, res) => {
  const sessionId = req.params.id;

  if (!isWatching(sessionId) && !isConnected(sessionId)) {
    res.status(404).json({ error: "Session not connected. Call POST /api/session/:id/connect first." });
    return;
  }

  // Set up SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();

  // Send initial connected event
  res.write(`data: ${JSON.stringify({ type: "connected", sessionId })}\n\n`);

  // Forward file watcher entries (new entries from any pi process)
  const fileListener: SessionEntryCallback = (entry) => {
    try {
      res.write(`data: ${JSON.stringify({ type: "session_entry", entry })}\n\n`);
    } catch {
      // Client disconnected — ignore
    }
  };

  // Forward RPC events (streaming deltas from Sol's subprocess)
  const rpcListener: RpcEventCallback = (event) => {
    try {
      if (event.type === "rpc_exit" || event.type === "rpc_error") {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        return;
      }
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    } catch {
      // Client disconnected — ignore
    }
  };

  if (isWatching(sessionId)) {
    onEntry(sessionId, fileListener);
  }
  if (isConnected(sessionId)) {
    onEvent(sessionId, rpcListener);
  }

  // Clean up on client disconnect
  req.on("close", () => {
    offEntry(sessionId, fileListener);
    if (isConnected(sessionId)) {
      offEvent(sessionId, rpcListener);
    }
  });
});

// Send prompt to active session
app.post("/api/session/:id/prompt", (req, res) => {
  const sessionId = req.params.id;

  if (!isConnected(sessionId)) {
    res.status(404).json({ error: "Session not connected. Call POST /api/session/:id/connect first." });
    return;
  }

  const { message } = req.body as { message?: string };
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "Missing required field: message" });
    return;
  }

  const sent = sendCommand(sessionId, { type: "prompt", message });
  if (sent) {
    res.json({ status: "sent" });
  } else {
    res.status(500).json({ error: "Failed to send prompt to RPC subprocess" });
  }
});

// Steer active session
app.post("/api/session/:id/steer", (req, res) => {
  const sessionId = req.params.id;

  if (!isConnected(sessionId)) {
    res.status(404).json({ error: "Session not connected. Call POST /api/session/:id/connect first." });
    return;
  }

  const { message } = req.body as { message?: string };
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "Missing required field: message" });
    return;
  }

  const sent = sendCommand(sessionId, { type: "steer", message });
  if (sent) {
    res.json({ status: "sent" });
  } else {
    res.status(500).json({ error: "Failed to send steer to RPC subprocess" });
  }
});

// Abort current operation
app.post("/api/session/:id/abort", (req, res) => {
  const sessionId = req.params.id;

  if (!isConnected(sessionId)) {
    res.status(404).json({ error: "Session not connected. Call POST /api/session/:id/connect first." });
    return;
  }

  const sent = sendCommand(sessionId, { type: "abort" });
  if (sent) {
    res.json({ status: "sent" });
  } else {
    res.status(500).json({ error: "Failed to send abort to RPC subprocess" });
  }
});

// Send follow-up to active session
app.post("/api/session/:id/follow_up", (req, res) => {
  const sessionId = req.params.id;

  if (!isConnected(sessionId)) {
    res.status(404).json({ error: "Session not connected. Call POST /api/session/:id/connect first." });
    return;
  }

  const { message } = req.body as { message?: string };
  if (!message || typeof message !== "string") {
    res.status(400).json({ error: "Missing required field: message" });
    return;
  }

  const sent = sendCommand(sessionId, { type: "follow_up", message });
  if (sent) {
    res.json({ status: "sent" });
  } else {
    res.status(500).json({ error: "Failed to send follow_up to RPC subprocess" });
  }
});

// Get session state via RPC
app.get("/api/session/:id/state", (req, res) => {
  const sessionId = req.params.id;

  if (!isConnected(sessionId)) {
    res.status(404).json({ error: "Session not connected. Call POST /api/session/:id/connect first." });
    return;
  }

  // Set up a one-time listener for the get_state response
  const timeout = setTimeout(() => {
    offEvent(sessionId, listener);
    res.status(504).json({ error: "Timeout waiting for state response" });
  }, 10_000);

  const listener: RpcEventCallback = (event) => {
    // Look for state response event
    if (event.type === "response" && event.command === "get_state") {
      clearTimeout(timeout);
      offEvent(sessionId, listener);
      res.json(event);
      return;
    }
    // Handle process exit while waiting
    if (event.type === "rpc_exit" || event.type === "rpc_error") {
      clearTimeout(timeout);
      offEvent(sessionId, listener);
      res.status(500).json({ error: "RPC subprocess terminated", details: event });
      return;
    }
  };

  onEvent(sessionId, listener);
  const sent = sendCommand(sessionId, { type: "get_state" });
  if (!sent) {
    clearTimeout(timeout);
    offEvent(sessionId, listener);
    res.status(500).json({ error: "Failed to send command to RPC subprocess" });
  }
});

// Get available models via RPC
app.get("/api/session/:id/models", (req, res) => {
  const sessionId = req.params.id;

  if (!isConnected(sessionId)) {
    res.status(404).json({ error: "Session not connected. Call POST /api/session/:id/connect first." });
    return;
  }

  const timeout = setTimeout(() => {
    offEvent(sessionId, listener);
    res.status(504).json({ error: "Timeout waiting for models response" });
  }, 10_000);

  const listener: RpcEventCallback = (event) => {
    if (event.type === "response" && event.command === "get_available_models") {
      clearTimeout(timeout);
      offEvent(sessionId, listener);
      if (event.success === false) {
        res.status(500).json({ error: "RPC command failed", details: event.error });
        return;
      }
      res.json(event);
      return;
    }
    if (event.type === "rpc_exit" || event.type === "rpc_error") {
      clearTimeout(timeout);
      offEvent(sessionId, listener);
      res.status(500).json({ error: "RPC subprocess terminated", details: event });
      return;
    }
  };

  onEvent(sessionId, listener);
  const sent = sendCommand(sessionId, { type: "get_available_models" });
  if (!sent) {
    clearTimeout(timeout);
    offEvent(sessionId, listener);
    res.status(500).json({ error: "Failed to send command to RPC subprocess" });
  }
});

// Get available commands (skills, slash commands) via RPC
app.get("/api/session/:id/commands", (req, res) => {
  const sessionId = req.params.id;

  if (!isConnected(sessionId)) {
    res.status(404).json({ error: "Session not connected. Call POST /api/session/:id/connect first." });
    return;
  }

  const timeout = setTimeout(() => {
    offEvent(sessionId, listener);
    res.status(504).json({ error: "Timeout waiting for commands response" });
  }, 10_000);

  const listener: RpcEventCallback = (event) => {
    if (event.type === "response" && event.command === "get_commands") {
      clearTimeout(timeout);
      offEvent(sessionId, listener);
      if (event.success === false) {
        res.status(500).json({ error: "RPC command failed", details: event.error });
        return;
      }
      res.json(event);
      return;
    }
    if (event.type === "rpc_exit" || event.type === "rpc_error") {
      clearTimeout(timeout);
      offEvent(sessionId, listener);
      res.status(500).json({ error: "RPC subprocess terminated", details: event });
      return;
    }
  };

  onEvent(sessionId, listener);
  const sent = sendCommand(sessionId, { type: "get_commands" });
  if (!sent) {
    clearTimeout(timeout);
    offEvent(sessionId, listener);
    res.status(500).json({ error: "Failed to send command to RPC subprocess" });
  }
});

// Switch model via RPC
app.put("/api/session/:id/model", (req, res) => {
  const sessionId = req.params.id;

  if (!isConnected(sessionId)) {
    res.status(404).json({ error: "Session not connected. Call POST /api/session/:id/connect first." });
    return;
  }

  const { provider, modelId } = req.body as { provider?: string; modelId?: string };
  if (!provider || typeof provider !== "string" || !modelId || typeof modelId !== "string") {
    res.status(400).json({ error: "Missing required fields: provider, modelId" });
    return;
  }

  const timeout = setTimeout(() => {
    offEvent(sessionId, listener);
    res.status(504).json({ error: "Timeout waiting for model switch response" });
  }, 10_000);

  const listener: RpcEventCallback = (event) => {
    if (event.type === "response" && event.command === "set_model") {
      clearTimeout(timeout);
      offEvent(sessionId, listener);
      if (event.success === false) {
        res.status(500).json({ error: "RPC command failed", details: event.error });
        return;
      }
      res.json(event);
      return;
    }
    if (event.type === "rpc_exit" || event.type === "rpc_error") {
      clearTimeout(timeout);
      offEvent(sessionId, listener);
      res.status(500).json({ error: "RPC subprocess terminated", details: event });
      return;
    }
  };

  onEvent(sessionId, listener);
  const sent = sendCommand(sessionId, { type: "set_model", provider, modelId });
  if (!sent) {
    clearTimeout(timeout);
    offEvent(sessionId, listener);
    res.status(500).json({ error: "Failed to send command to RPC subprocess" });
  }
});

// --- Session Management Endpoints ---

// Fork a session from a specific entry
// Creates a new branch point at the specified user message entry.
// The session "rewinds" to the fork point, ready for new prompts.
// Note: Pi's RPC fork command does not support summarization options.
app.post("/api/session/:id/fork", async (req, res) => {
  const sessionId = req.params.id;

  if (!isConnected(sessionId)) {
    res.status(404).json({ error: "Session not connected. Call POST /api/session/:id/connect first." });
    return;
  }

  const { entryId } = req.body as {
    entryId?: string;
  };

  if (!entryId || typeof entryId !== "string") {
    res.status(400).json({ error: "Missing required field: entryId" });
    return;
  }

  console.log(`[fork] Starting fork for session ${sessionId}, entryId: ${entryId}`);

  const timeout = setTimeout(() => {
    console.log(`[fork] Timeout waiting for fork response for session ${sessionId}`);
    offEvent(sessionId, listener);
    res.status(504).json({ error: "Timeout waiting for fork response" });
  }, 30_000); // Longer timeout for fork (may involve summarization)

  const listener: RpcEventCallback = (event) => {
    console.log(`[fork] Received RPC event for session ${sessionId}:`, JSON.stringify(event).slice(0, 500));
    
    // Handle successful fork response
    if (event.type === "response" && event.command === "fork") {
      clearTimeout(timeout);
      offEvent(sessionId, listener);
      if (event.success === false) {
        console.log(`[fork] Fork failed:`, event.error);
        res.status(500).json({ error: "Fork failed", details: event.error });
        return;
      }
      const data = event.data as { text?: string; cancelled?: boolean } | undefined;
      if (data?.cancelled) {
        console.log(`[fork] Fork was cancelled by extension`);
        res.status(409).json({ error: "Fork was cancelled by an extension" });
        return;
      }
      console.log(`[fork] Fork successful`);
      res.json({
        success: true,
        text: data?.text,
        // After fork, the session file has changed, but we continue with the same RPC subprocess
        // The client should re-fetch the session to get the forked branch
      });
      return;
    }
    // Handle parse error (invalid command format or invalid entry ID)
    if (event.type === "response" && event.command === "parse" && event.success === false) {
      clearTimeout(timeout);
      offEvent(sessionId, listener);
      const errorMsg = (event.error as string) || "Invalid fork command";
      console.log(`[fork] Parse error:`, errorMsg);
      res.status(400).json({ error: errorMsg });
      return;
    }
    if (event.type === "rpc_exit" || event.type === "rpc_error") {
      clearTimeout(timeout);
      offEvent(sessionId, listener);
      console.log(`[fork] RPC subprocess terminated:`, event);
      res.status(500).json({ error: "RPC subprocess terminated", details: event });
      return;
    }
  };

  onEvent(sessionId, listener);

  // Pi's RPC fork command takes only entryId - creates a branch point at that entry
  console.log(`[fork] Sending fork command to RPC subprocess`);
  const sent = sendCommand(sessionId, { type: "fork", entryId });
  console.log(`[fork] Command sent: ${sent}`);
  if (!sent) {
    clearTimeout(timeout);
    offEvent(sessionId, listener);
    res.status(500).json({ error: "Failed to send fork command to RPC subprocess" });
  }
});

// Create a new session in a given working directory
app.post("/api/sessions/new", async (req, res) => {
  const { cwd } = req.body as { cwd?: string };

  if (!cwd || typeof cwd !== "string") {
    res.status(400).json({ error: "Missing required field: cwd" });
    return;
  }

  // Validate that cwd exists and is a directory
  try {
    const fs = await import("node:fs/promises");
    const stat = await fs.stat(cwd);
    if (!stat.isDirectory()) {
      res.status(400).json({ error: "cwd is not a directory" });
      return;
    }
  } catch {
    res.status(400).json({ error: "cwd does not exist or is not accessible" });
    return;
  }

  // Generate a temporary session ID for the new subprocess
  // We'll replace this with the real session ID once pi creates the session
  const tempSessionId = `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  // Spawn RPC subprocess in the target cwd
  // Pass empty session-dir to let pi create a new session file
  const spawned = spawnRpc(tempSessionId, "", cwd);
  if (!spawned) {
    res.status(500).json({ error: "Failed to spawn RPC subprocess" });
    return;
  }

  // Helper to get the real session ID via get_state after new_session succeeds
  const getRealSessionId = (): Promise<string> => {
    return new Promise((resolve, reject) => {
      const stateTimeout = setTimeout(() => {
        offEvent(tempSessionId, stateListener);
        reject(new Error("Timeout waiting for get_state response"));
      }, 5000);

      const stateListener: RpcEventCallback = (event) => {
        if (event.type === "response" && event.command === "get_state") {
          clearTimeout(stateTimeout);
          offEvent(tempSessionId, stateListener);
          if (event.success === false) {
            reject(new Error("get_state failed"));
            return;
          }
          const data = event.data as { sessionId?: string } | undefined;
          if (data?.sessionId) {
            resolve(data.sessionId);
          } else {
            reject(new Error("No sessionId in get_state response"));
          }
        }
        if (event.type === "rpc_exit" || event.type === "rpc_error") {
          clearTimeout(stateTimeout);
          offEvent(tempSessionId, stateListener);
          reject(new Error("RPC subprocess terminated"));
        }
      };

      onEvent(tempSessionId, stateListener);
      sendCommand(tempSessionId, { type: "get_state" });
    });
  };

  // Send new_session command to initialize
  const timeout = setTimeout(() => {
    offEvent(tempSessionId, listener);
    res.status(504).json({ error: "Timeout waiting for new_session response" });
  }, 10_000);

  const listener: RpcEventCallback = (event) => {
    if (event.type === "response" && event.command === "new_session") {
      clearTimeout(timeout);
      offEvent(tempSessionId, listener);
      if (event.success === false) {
        res.status(500).json({ error: "new_session failed", details: event.error });
        return;
      }
      const data = event.data as { cancelled?: boolean } | undefined;
      if (data?.cancelled) {
        res.status(409).json({ error: "New session was cancelled by an extension" });
        return;
      }

      // Get the real session ID from pi and re-key the RPC process
      getRealSessionId()
        .then((realSessionId) => {
          // Re-key the RPC process under the real session ID
          rekeyRpc(tempSessionId, realSessionId);
          res.json({
            success: true,
            sessionId: realSessionId,
            cwd,
          });
        })
        .catch((err) => {
          // Fall back to temp ID if we can't get the real one
          console.error("Failed to get real session ID:", err);
          res.json({
            success: true,
            sessionId: tempSessionId,
            cwd,
          });
        });
      return;
    }
    if (event.type === "rpc_exit" || event.type === "rpc_error") {
      clearTimeout(timeout);
      offEvent(tempSessionId, listener);
      res.status(500).json({ error: "RPC subprocess terminated", details: event });
      return;
    }
  };

  onEvent(tempSessionId, listener);
  const sent = sendCommand(tempSessionId, { type: "new_session" });
  if (!sent) {
    clearTimeout(timeout);
    offEvent(tempSessionId, listener);
    res.status(500).json({ error: "Failed to send new_session command to RPC subprocess" });
  }
});

// --- File Inspector Endpoints ---

// Get git working tree changes for a session's cwd
app.get("/api/files/:id", async (req, res) => {
  try {
    const session = await findSessionById(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const files = await getGitStatus(session.cwd);
    if (files === null) {
      res.status(404).json({ error: "Session cwd is not a git repository" });
      return;
    }

    res.json({ cwd: session.cwd, files });
  } catch (err) {
    console.error("Failed to get git status:", err);
    res.status(500).json({ error: "Failed to get git status" });
  }
});

// Get file contents (with path traversal protection)
app.get("/api/files/:id/content", async (req, res) => {
  try {
    const session = await findSessionById(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const filePath = typeof req.query.path === "string" ? req.query.path : "";
    if (!filePath) {
      res.status(400).json({ error: "Missing required query parameter: path" });
      return;
    }

    const content = await getFileContent(session.cwd, filePath);
    if (content === null) {
      res.status(403).json({ error: "Invalid file path" });
      return;
    }

    res.json({ path: filePath, content });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("ENOENT")) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    console.error("Failed to read file:", err);
    res.status(500).json({ error: "Failed to read file" });
  }
});

// Get all git-tracked files in the session's cwd (for file picker)
app.get("/api/files/:id/tree", async (req, res) => {
  try {
    const session = await findSessionById(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const files = await getGitTrackedFiles(session.cwd);
    if (files === null) {
      res.status(404).json({ error: "Session cwd is not a git repository" });
      return;
    }

    res.json({ cwd: session.cwd, files });
  } catch (err) {
    console.error("Failed to get git tracked files:", err);
    res.status(500).json({ error: "Failed to get git tracked files" });
  }
});

// Get git diff for a file
app.get("/api/files/:id/diff", async (req, res) => {
  try {
    const session = await findSessionById(req.params.id);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const filePath = typeof req.query.path === "string" ? req.query.path : "";
    if (!filePath) {
      res.status(400).json({ error: "Missing required query parameter: path" });
      return;
    }

    const diff = await getGitDiff(session.cwd, filePath);
    if (diff === null) {
      res.status(404).json({ error: "Not a git repository or invalid path" });
      return;
    }

    res.json({ path: filePath, diff });
  } catch (err) {
    console.error("Failed to get git diff:", err);
    res.status(500).json({ error: "Failed to get git diff" });
  }
});

// Serve Vite build output in production
const staticDir = path.resolve(__dirname, "..", "frontend", "dist");
app.use(express.static(staticDir));

// SPA fallback — serve index.html for non-API routes
app.get("*", (_req, res) => {
  res.sendFile(path.join(staticDir, "index.html"), (err) => {
    if (err) {
      res.status(404).send("Not found");
    }
  });
});
