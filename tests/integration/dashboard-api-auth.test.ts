import assert from "node:assert/strict";
import { test } from "node:test";
import { createDashboardApi } from "../../src/dashboard-api/routes.js";

test("refuses a missing token at startup and blocks unauthenticated reads and writes", async () => {
  const options = { auditPath: "", riskPath: "", initialCents: 100 };
  assert.throws(() => createDashboardApi({ ...options, token: "" }), /DASHBOARD_API_TOKEN/);
  const app = createDashboardApi({ ...options, token: "test" });
  assert.equal((await app.request("/health")).status, 401);
  assert.equal((await app.request("/risk-config", { method: "POST" })).status, 401);
  assert.equal((await app.request("/health", { headers: { Authorization: "Bearer test" } })).status, 200);
  assert.equal((await app.request("/risk-config", { method: "POST", headers: { Authorization: "Bearer test" }, body: "{}" })).status, 400);
});

test("Vercel allows preflight from the configured frontend and still protects reads", async t => {
  const { GET, OPTIONS } = await import("../../api/dashboard-data.js");
  const originalOrigin = process.env.DASHBOARD_ORIGIN;
  const originalToken = process.env.DASHBOARD_API_TOKEN;
  t.after(() => {
    if (originalOrigin === undefined) delete process.env.DASHBOARD_ORIGIN;
    else process.env.DASHBOARD_ORIGIN = originalOrigin;
    if (originalToken === undefined) delete process.env.DASHBOARD_API_TOKEN;
    else process.env.DASHBOARD_API_TOKEN = originalToken;
  });
  process.env.DASHBOARD_ORIGIN = "https://app.example.com";
  process.env.DASHBOARD_API_TOKEN = "test";
  const url = "https://api.example.com/api/dashboard-data?endpoint=/health";
  const allowed = new Request(url, { method: "OPTIONS", headers: { Origin: "https://app.example.com" } });
  const denied = new Request(url, { method: "OPTIONS", headers: { Origin: "https://other.example.com" } });
  assert.equal((await OPTIONS(allowed)).status, 204);
  assert.equal((await OPTIONS(denied)).status, 403);
  const unauthorized = await GET(new Request(url, { headers: { Origin: "https://app.example.com" } }));
  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorized.headers.get("access-control-allow-origin"), "https://app.example.com");
});
