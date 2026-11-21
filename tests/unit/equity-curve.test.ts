import { test } from "node:test";
import assert from "node:assert/strict";
import { equityCurve } from "../../src/agents/equity-curve.js";
import { id, now, mockApi } from "../agent-fixture.js";
test("publishes realized equity and current timestamp independently of input timestamp", async (t) => {
  const data = {
    starting_equity_usd: 1000,
    as_of: now - 300,
    closed_trades: [10, -4].map((pnl_usd, i) => ({
      run_id: "trade" + i,
      token: id.token,
      closed_at: now - 10 + i,
      hold_sec: 20,
      slippage_bps: 10,
      pnl_usd,
    })),
  };
  const expected = {
    equity_usd: 1006,
    drawdown_pct: 4 / 1010,
    win_rate: 0.5,
    expectancy_usd: 3,
    trades_closed: 2,
    as_of: now,
  };
  let result = expected;
  const { call } = mockApi(t, () => result);
  assert.deepEqual(await equityCurve(call, id, data), expected);
  result = { ...expected, as_of: data.as_of };
  await assert.rejects(equityCurve(call, id, data));
});

import { pinnedPrompt } from "../agent-fixture.js";
test("reviewed prompt matches the tested contract", () =>
  pinnedPrompt("equity-curve", "77e5e75b98b1a1c2af8893f85327bef9772aa8a3a0f695c03cf750847e74fc35"));
