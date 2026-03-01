import { app } from "./app.js";
import { killAllRpc } from "./rpc.js";

const PORT = 8081;
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Sol server listening on http://0.0.0.0:${PORT}`);
});

// Graceful shutdown — terminate all active RPC subprocesses
function shutdown(signal: string): void {
  console.log(`\n[server] Received ${signal}, shutting down...`);
  killAllRpc();
  server.close(() => {
    console.log("[server] HTTP server closed");
    process.exit(0);
  });
  // Force exit after 5s if graceful shutdown stalls
  setTimeout(() => {
    console.error("[server] Forced shutdown after timeout");
    process.exit(1);
  }, 5000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export { server };
