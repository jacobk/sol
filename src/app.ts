import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listGroupedSessions, getSessionById, getSessionTree, getSessionBranch, searchSessions, searchSessionEntries, findSessionById } from "./sessions.js";
import { spawnRpc, sendCommand, onEvent, offEvent, isConnected, killAllRpc, type RpcEventCallback } from "./rpc.js";

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

// Connect to a session — spawn RPC subprocess
app.post("/api/session/:id/connect", async (req, res) => {
  try {
    const sessionId = req.params.id;

    // If already connected, return existing status
    if (isConnected(sessionId)) {
      res.json({ status: "already_connected", sessionId });
      return;
    }

    // Look up session to get path and cwd
    const session = await findSessionById(sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }

    const spawned = spawnRpc(sessionId, path.dirname(session.path), session.cwd);
    if (spawned) {
      res.json({ status: "connected", sessionId });
    } else {
      // Race condition: another request connected between our check and spawn
      res.json({ status: "already_connected", sessionId });
    }
  } catch (err) {
    console.error("Failed to connect to session:", err);
    res.status(500).json({ error: "Failed to connect to session" });
  }
});

// Stream RPC events via SSE
app.get("/api/session/:id/stream", (req, res) => {
  const sessionId = req.params.id;

  if (!isConnected(sessionId)) {
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

  // Forward RPC events to SSE
  const listener: RpcEventCallback = (event) => {
    // If the subprocess exited or errored, send the event and close
    if (event.type === "rpc_exit" || event.type === "rpc_error") {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      res.end();
      return;
    }
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  onEvent(sessionId, listener);

  // Clean up on client disconnect
  req.on("close", () => {
    offEvent(sessionId, listener);
  });
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
