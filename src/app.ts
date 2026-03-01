import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listGroupedSessions, getSessionById, getSessionTree, getSessionBranch, searchSessions, searchSessionEntries, findSessionById } from "./sessions.js";
import { spawnRpc, sendCommand, onEvent, offEvent, isConnected, killAllRpc, type RpcEventCallback } from "./rpc.js";
import { startWatching, onEntry, offEntry, isWatching, stopAllWatchers, type SessionEntryCallback } from "./session-watcher.js";

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
    if (!isConnected(sessionId)) {
      spawnRpc(sessionId, path.dirname(session.path), session.cwd);
    }

    res.json({ status: "connected", sessionId });
  } catch (err) {
    console.error("Failed to connect to session:", err);
    res.status(500).json({ error: "Failed to connect to session" });
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
    if (event.type === "state" || event.type === "get_state_response") {
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
