import { test } from "node:test";
import assert from "node:assert/strict";
import { executor } from "../../src/agents/executor.js";
import { id, now, fill, mockApi } from "../agent-fixture.js";
test("aborts on excessive slippage and reports a missing quote as an error", async (t) => {
  const input = {
    sizer: { status: "SIZED" as const, size_usd: 10, max_slippage_bps: 150 },
    action: "entry" as const,
    position: null,
    market: { quote_price: 2, expected_slippage_bps: 200, gas_usd: 0, now },
  };
  const result = { ...fill, status: "ABORTED", fill_price: null, reason: "slippage_above_max" };
  const { call } = mockApi(t, () => result);
  assert.deepEqual(await executor(call, id, input), result);
  assert.throws(() => executor(call, id, { ...input, market: { ...input.market, quote_price: undefined! } }), /ERROR/);
});

import { pinnedPrompt } from "../agent-fixture.js";
test("reviewed prompt matches the tested contract", () =>
  pinnedPrompt("executor", "f1f9c41e6d32d66c9b83a0ea6505fb15fadeafc64a4f787916c8a2e4f15d1b94"));

test("exit handles stop loss, take profit, max hold and no trigger", async (t) => {
  let result: unknown;
  const { call } = mockApi(t, () => result);
  for (const [price, age, status] of [
    [1.8, 1, "FILLED"],
    [2.2, 1, "FILLED"],
    [2, 60, "FILLED"],
    [2, 59, "SKIPPED"],
  ] as const) {
    result = {
      ...fill,
      action: "exit",
      status,
      fill_price: status === "FILLED" ? price : null,
      reason: status === "FILLED" ? "exit" : "no_exit_trigger",
    };
    assert.deepEqual(
      await executor(call, id, {
        sizer: { status: "SIZED", size_usd: 10, max_slippage_bps: 150 },
        action: "exit",
        position: { entry_price: 2, opened_at: now - age, stop_loss_bps: 500, take_profit_bps: 500, max_hold_sec: 60 },
        market: { quote_price: price, expected_slippage_bps: 0, gas_usd: 0, now },
      }),
      result,
    );
  }
});
