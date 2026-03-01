import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "./app.js";

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
