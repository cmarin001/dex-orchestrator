import assert from "node:assert/strict";
import { test } from "node:test";
import { GET } from "../../api/dashboard-data.js";
import { log, observe, withLogContext } from "../../src/logging/operational.js";

test("operational records correlate concurrent runs and exclude exception contents", async t => {
  const previousLevel = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = "debug";
  t.after(() => {
    if (previousLevel === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = previousLevel;
  });
  const lines: string[] = [];
  t.mock.method(console, "log", (line: string) => { lines.push(line); });
  t.mock.method(console, "error", (line: string) => { lines.push(line); });

  const error = new Error("sensitive-provider-payload");
  await Promise.all([
    withLogContext({ run_id: "run-a", chain: "base" }, () =>
      observe("test.success", {}, async () => { await Promise.resolve(); })),
    withLogContext({ run_id: "run-b", chain: "solana" }, () =>
      assert.rejects(observe("test.failure", {}, async () => { throw error; }), { message: error.message })),
  ]);
  const records = lines.map(line => JSON.parse(line));
  assert.equal(records.find(row => row.event === "test.success").run_id, "run-a");
  assert.equal(records.find(row => row.event === "test.failure").run_id, "run-b");
  assert.ok(records.every(row => row.duration_ms >= 0));
  assert.ok(lines.every(line => !line.includes(error.message)));

  process.env.LOG_LEVEL = "warn";
  log("info", "test.filtered");
  log("warn", "test.visible");
  assert.equal(lines.length, 3);
  assert.equal(JSON.parse(lines[2] ?? "{}").event, "test.visible");
});

test("dashboard request logs omit supplied headers and query strings", async t => {
  const previousToken = process.env.DASHBOARD_API_TOKEN;
  const previousLevel = process.env.LOG_LEVEL;
  process.env.DASHBOARD_API_TOKEN = "dashboard-test-secret";
  process.env.LOG_LEVEL = "info";
  t.after(() => {
    for (const [key, value] of Object.entries({ DASHBOARD_API_TOKEN: previousToken, LOG_LEVEL: previousLevel })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const calls = t.mock.method(console, "error", () => {});
  const response = await GET(new Request("https://example.test/api/dashboard-data?endpoint=/health&token=query-value", {
    headers: { Authorization: "Bearer invalid-authorization-value" },
  }));
  assert.equal(response.status, 401);
  // Warnings go to stderr and produce one record even through the Vercel facade.
  assert.equal(calls.mock.callCount(), 1);
  const line = String(calls.mock.calls[0]?.arguments[0]);
  assert.ok(!/query-value|invalid-authorization-value|dashboard-test-secret/.test(line));
  const record = JSON.parse(line);
  assert.equal(record.event, "http.request");
  assert.equal(record.route, "/api/dashboard-data/health");
  assert.equal(record.status, 401);
  assert.ok(record.request_id);
});
