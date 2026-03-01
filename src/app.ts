import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listGroupedSessions, getSessionById, getSessionTree, getSessionBranch, searchSessions, searchSessionEntries } from "./sessions.js";

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
