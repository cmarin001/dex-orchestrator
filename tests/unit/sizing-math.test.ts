import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Equity, sizePosition } from "../../src/state/equity.js";

test("floors a nonintegral cap and preserves tighter cash and requested limits", () => {
  assert.equal(sizePosition(8000, 100_099, 100_099, 100), 1000);
  assert.equal(sizePosition(5000, 100_000, 100, 100), 100);
  assert.equal(sizePosition(25, 100_000, 500, 100), 25);
  assert.equal(sizePosition(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, 10_000),
    Number.MAX_SAFE_INTEGER);
  assert.throws(() => sizePosition(0, 100, 100, 10_001), RangeError);
});

test("marks at current value without double counting previous marks", () => {
  const equity = new Equity(100_000);
  const position = { run_id: "test", chain: "base" as const, token: "token", pair: "pair",
    cost_cents: 1000, entry_price_usd: 2 };
  equity.mark(position, 4);
  assert.equal(equity.markedCapitalCents, 101_000);
  equity.mark(position, 1);
  assert.equal(equity.markedCapitalCents, 99_500);
});

test("reserves cash against the portfolio peak even if every holding becomes worthless", () => {
  const equity = new Equity(100_000);
  assert.equal(equity.entryCapacityCents(14_500, .15), 500);
  equity.restoreRealized(-500);
  assert.equal(equity.entryCapacityCents(14_500, .15), 0);
  equity.restoreRealized(10_500);
  assert.equal(equity.entryCapacityCents(10_000, .15), 6500);
});
