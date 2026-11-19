import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultLadder } from "../../schemas/exit-policy.js";
import { liveViewSchema } from "../../schemas/live-view.js";
import { createDashboardApi } from "../../src/dashboard-api/routes.js";
import type { JournalEvent } from "../../src/logging/types.js";

test("publishes a recorded mark through JSON and authenticated SSE", async () => {
  const now = Date.now();
  const identity = { run_id: "trade", chain: "base" as const, token: "token", pair: "pair" };
  const events: JournalEvent[] = [
    { at: new Date(now - 601_000).toISOString(), stage: "executor", status: "paper_fill", gaps: [], identity,
      position: { ...identity, cost_cents: 100, entry_price_usd: 10, exit_policy: {
        mode: "profit_only", entry_at: now - 601_000, entry_price: 10,
        min_profit_bps_for_exit: 25, max_hold_sec: 3600, timeout_ladder: defaultLadder,
      } } },
    { at: new Date(now - 100).toISOString(), stage: "position_mark", status: "ok", gaps: [], identity,
      detail: { t: now - 100, price: 10.1, source: "dexscreener" } },
  ];
  const app = createDashboardApi({ token: "test", auditPath: "", riskPath: "", initialCents: 100, events: async () => events });
  const headers = { Authorization: "Bearer test" };
  const result = await app.request("/live-view?token=token", { headers });
  const items = liveViewSchema.array().parse(await result.json());
  assert.equal(items[0]?.active_target_bps, 250);
  assert.equal(items[0]?.current_mark?.price, 10.1);
  assert.equal(items[0]?.target_series.length, 3);
  const response = await app.request("/live-view/stream", { headers });
  assert.match(response.headers.get("content-type") ?? "", /text\/event-stream/);
  const reader = response.body?.getReader();
  assert.ok(reader);
  const frame = await reader.read();
  assert.match(new TextDecoder().decode(frame.value), /event: live-view/);
  await reader.cancel();
});
