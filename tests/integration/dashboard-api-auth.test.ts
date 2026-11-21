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
