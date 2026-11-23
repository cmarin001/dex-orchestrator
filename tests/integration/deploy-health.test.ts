import { serve } from "@hono/node-server";
import { once } from "node:events";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createDashboardApi } from "../../src/dashboard-api/routes.js";

test("only direct loopback probes can read unauthenticated deploy health", async t => {
  const at = "2026-01-01T00:00:00.000Z";
  const app = createDashboardApi({
    token: "fixture", auditPath: "unused", riskPath: "unused", initialCents: 1,
    deployHealth: { version: "fixture-version", intervalMs: 60_000 },
    events: async () => [{ at, stage: "worker_cycle", status: "ok", gaps: [] }],
  });
  const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
  t.after(() => { server.close(); if ("closeAllConnections" in server) server.closeAllConnections(); });
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = "http://127.0.0.1:" + address.port;
  const probe = await fetch(base + "/api/v1/health");
  assert.equal(probe.status, 200);
  assert.deepEqual(await probe.json(), {
    ok: true, version: "fixture-version", last_cycle_at: at, journal_readable: true, loop_interval_sec: 60,
  });
  assert.equal((await fetch(base + "/api/v1/status")).status, 401);
  assert.equal((await fetch(base + "/api/v1/health", { headers: { "X-Dex-Proxy": "1" } })).status, 401);
  const ui = await fetch(base + "/api/v1/health", { headers: { Authorization: "Bearer fixture", "X-Dex-Proxy": "1" } });
  assert.equal(ui.status, 200);
  assert.equal((await ui.json()).status, "ok");
});

test("authenticated health and status project worker journal evidence", async () => {
  const at = "2026-01-01T00:00:00.000Z";
  const app = createDashboardApi({
    token: "fixture", auditPath: "unused", riskPath: "unused", initialCents: 1,
    deployHealth: { version: "fixture-version", intervalMs: 60_000 },
    events: async () => [
      { at, stage: "worker_lifecycle", status: "ok", gaps: [], detail: "running" },
      { at, stage: "worker_cycle", status: "ok", gaps: [], detail: { duration_ms: 12, loop_interval_sec: 60 } },
    ],
  });
  const headers = { Authorization: "Bearer fixture" };
  const read = (path: string) => app.request(path, { headers });
  assert.equal((await app.request("/api/v1/system/health")).status, 401);
  const health = await read("/api/v1/health");
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok", ok: true, mode: "paper", version: "fixture-version",
    last_cycle_at: at, journal_readable: true, loop_interval_sec: 60 });
  const status = await (await read("/api/v1/status")).json();
  assert.equal(status.last_cycle_at, at);
  assert.equal(status.loop_state, "running");
  assert.equal(status.cycle_duration_ms, 12);
  assert.equal(status.live_execution_enabled, false);
  assert.equal(status.exposure_usd, 0);
  assert.equal(status.current_equity, null);
  const system = await (await read("/api/v1/system/health")).json();
  assert.deepEqual(system.cycle_latency_ms, { p50: 12, p95: 12, p99: 12 });
  assert.deepEqual(system.cache, { recon_hit_pct: null, response_hit_pct: null, dedup_count: null });
});
