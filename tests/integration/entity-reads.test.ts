import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createControl } from "../../src/control/service.js";
import { createDashboardApi } from "../../src/dashboard-api/routes.js";
import { createMcp } from "../../src/mcp/tools.js";
import type { JournalEvent } from "../../src/logging/types.js";
import { identity } from "../control-fixture.js";

test("entity routes authenticate and match the read-only MCP tools on journal evidence", async t => {
  const at = "2024-06-01T00:00:00.000Z";
  const time = Date.parse(at);
  const other = { ...identity, run_id: "still-open", token: "0x" + "3".repeat(40) };
  const closed = { ...identity, strategy_id: "momentum", cost_cents: 1000, entry_price_usd: 2 };
  const scan = { ...identity, trigger: "new_pair", discovered_at: time / 1000, liquidity_usd: 10000,
    vol_1h_usd: 100, age_sec: 10, rank_score: 1, reason: "ranked", skipped: false };
  const events: JournalEvent[] = [
    { at, stage: "scanner_batch", status: "ok", gaps: [], detail: [scan] },
    { at, identity, stage: "scanner", status: "ok", gaps: [], detail: [scan] },
    { at, identity, stage: "rug-check", status: "ok", gaps: [], detail: { verdict: "PASS" } },
    { at, identity, stage: "sizer", status: "ok", gaps: [], detail: { proposal: { status: "SIZED" }, approved_cents: 1000 } },
    { at, identity, stage: "executor", status: "paper_fill", gaps: [], position: closed },
    { at, identity, stage: "executor", status: "paper_close", gaps: [], position: closed,
      close: { exit_at: time + 120_000, exit_price: 3, exit_reason: "target", proceeds_cents: 1500 } },
    { at, identity: other, stage: "executor", status: "paper_fill", gaps: [],
      position: { ...other, cost_cents: 600, entry_price_usd: 2 } },
    { at, stage: "equity-curve", status: "ok", gaps: [], detail: { as_of: time / 1000,
      equity_usd: 1005, drawdown_pct: 1, win_rate: 1, expectancy_usd: 5, trades_closed: 1 } },
  ];
  const options = { auditPath: "unused", riskPath: "unused", initialCents: 100_000, token: "test", events: async () => events };
  const api = createDashboardApi(options);
  const server = createMcp(createControl(options), "desk", true);
  const [peer, transport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "entity-test", version: "1.0.0" });
  await server.connect(transport);
  await client.connect(peer);
  t.after(async () => { await client.close(); await server.close(); });
  const headers = { Authorization: "Bearer test" };
  async function compare(path: string, name: string, args: Record<string, unknown> = {}) {
    const response = await api.request(path, { headers });
    assert.equal(response.status, 200, path);
    const json = await response.json();
    const result = await client.callTool({ name, arguments: args });
    assert.equal(result.isError, undefined, name);
    if (name === "get_position") {
      assert.ok(Math.abs(json.age_sec - Number((result.structuredContent as typeof json).age_sec)) <= 1);
      delete json.age_sec;
      assert.ok(result.structuredContent);
      delete (result.structuredContent as Record<string, unknown>).age_sec;
    }
    assert.deepEqual(result.structuredContent, json, name);
    return json;
  }
  assert.equal((await api.request("/api/v1/trades")).status, 401);
  const position = await compare("/api/v1/positions/still-open", "get_position", { id: "still-open" });
  assert.equal(position.exit_policy, null);
  assert.equal(position.unrealized_pnl_usd, null);
  assert.equal(position.events.length, 1);
  const trades = await compare("/api/v1/trades?strategy_id=momentum", "list_trades", { strategy_id: "momentum" });
  assert.equal(trades.items[0].trigger, "new_pair");
  assert.equal(trades.items[0].pnl_usd, 5);
  const legacy = await (await api.request("/trades", { headers })).json();
  assert.equal(legacy.items[0].entry_price, 2);
  assert.ok(!("strategy_id" in legacy.items[0]));
  assert.equal((await compare("/api/v1/trades/fixture-run", "get_trades_id", { id: "fixture-run" })).events.length, 5);
  const until = "2024-06-02T00:00:00.000Z";
  const suffix = "?until=" + encodeURIComponent(until);
  const performance = await compare("/api/v1/performance" + suffix, "get_performance", { until });
  assert.equal(performance.current_equity_usd, 1005);
  assert.equal(performance.average_hold_sec, 120);
  assert.equal(performance.fees_usd, null);
  const funnel = await compare("/api/v1/funnel" + suffix, "get_funnel", { until });
  assert.deepEqual(funnel.counts, { scanned: 1, rug_pass: 1, sized: 1, filled: 2 });
  const chains = await compare("/api/v1/chains", "list_chains");
  assert.equal(chains.items.find((chain: { chain: string }) => chain.chain === "base").exposure_usd, 6);
  assert.equal((await api.request("/api/v1/trades/unknown", { headers })).status, 404);
  assert.equal((await api.request("/api/v1/trades?cursor=stale", { headers })).status, 400);
  assert.equal((await api.request("/api/v1/performance?range=7d&range=1h", { headers })).status, 400);
  assert.equal((await api.request("/api/v1/funnel?range=all&until=" + encodeURIComponent(until), { headers })).status, 400);
});
