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
