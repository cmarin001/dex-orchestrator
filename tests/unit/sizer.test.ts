import { test } from "node:test";
import assert from "node:assert/strict";
import { sizer } from "../../src/agents/sizer.js";
import { defaultRisk } from "../../schemas/risk-config.js";
import { id, now, sizing, mockApi } from "../agent-fixture.js";
test("Sizer validates missing equity, time, drawdown, gas and null tokens", async (t) => {
  const { timeout_ladder, ...risk } = defaultRisk;
  const input = {
    rug: { verdict: "PASS" as const },
    config: { ...risk, max_equity_age_sec: 60 },
    equity: { equity_usd: 1000, drawdown_pct: 0.05, as_of: now },
    market: { liquidity_usd: 50000, volatility_pct: 0, gas_usd: 0 },
  };
  let result: unknown = { ...sizing, size_tokens: null };
  const { call } = mockApi(t, () => result);
  assert.deepEqual(await sizer(call, id, input), result);
  for (const [equity, reason, status] of [
    [null, "no_equity", "REFUSED"],
    [{ ...input.equity, as_of: now - 61 }, "stale_equity", "REFUSED"],
    [{ ...input.equity, drawdown_pct: 0.15 }, "drawdown_circuit_breaker", "HALTED"],
  ] as const) {
    result = {
      ...sizing,
      status,
      reason,
      size_usd: 0,
      size_tokens: null,
      equity_at_decision: equity?.equity_usd ?? null,
      equity_age_sec: equity ? now - equity.as_of : null,
    };
    assert.deepEqual(await sizer(call, id, { ...input, equity }), result);
  }
  result = { ...sizing, reason: "no_equity", status: "REFUSED", equity_at_decision: 0, equity_age_sec: 0 };
  await assert.rejects(sizer(call, id, { ...input, equity: null }));
});

import { pinnedPrompt } from "../agent-fixture.js";
test("reviewed prompt matches the tested contract", () =>
  pinnedPrompt("sizer", "8171ce54261dffe810930ead7ad713807ec099e060008642a01f02992f9a3aac"));
