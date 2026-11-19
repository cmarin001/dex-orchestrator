import assert from "node:assert/strict";
import { test } from "node:test";
import type { JournalEvent } from "../../src/logging/types.js";
import { projectTradeHistory } from "../../src/logging/projections/trade-history.js";

test("projects three closed fills and ignores two rejected entries", () => {
  const events: JournalEvent[] = [];
  for (let i = 1; i < 6; i += 1) {
    const identity = { run_id: "trade-" + i, chain: "base" as const, token: "token", pair: "pair" };
    const at = new Date(i * 1000).toISOString();
    if (i > 3) { events.push({ at, identity, stage: "scanner", status: "skipped", gaps: [] }); continue; }
    const position = { ...identity, cost_cents: 100, entry_price_usd: 1 };
    events.push({ at, identity, position, status: "paper_fill", stage: "executor", gaps: [] },
      { at: new Date((i + 10) * 1000).toISOString(), identity, position, status: "paper_close", stage: "executor", gaps: [],
        close: { exit_at: (i + 10) * 1000, exit_price: 1 + i / 100, proceeds_cents: 100 + i, exit_reason: "target" } });
  }
  assert.deepEqual(projectTradeHistory(events).map(row => [row.run_id, row.pnl_usd, row.hold_sec]),
    [["trade-3", 0.03, 10], ["trade-2", 0.02, 10], ["trade-1", 0.01, 10]]);
});
