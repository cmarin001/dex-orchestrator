import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultLadder, exitPolicySchema } from "../../schemas/exit-policy.js";
import { canExit } from "../../src/exits/policy.js";

test("profit-only never permits a mark below entry for varied prices, losses and hold durations", () => {
  for (const entry of [0.000000001, 0.01, 1, 100, 100000, 1e12]) {
    const policy = exitPolicySchema.parse({ mode: "profit_only", entry_at: 1000, entry_price: entry,
      min_profit_bps_for_exit: 25, timeout_ladder: defaultLadder, max_hold_sec: 3600 });
    for (let i = 1; i < 1000; i += 1) {
      for (const sec of [0, 599, 600, 899, 900, 3600, 14400]) {
        assert.equal(canExit(policy, { price: entry * (i / 1000), at: 1000 + sec * 1000 }), false);
      }
    }
    assert.equal(canExit(policy, { price: entry * 1.01, at: 1000 + 900_000 }), true);
    assert.equal(exitPolicySchema.safeParse({ ...policy, stop_loss_bps: 100 }).success, false);
    assert.equal(canExit({ ...policy, mode: "stop_loss", stop_loss_bps: 100 },
      { price: entry * 0.9, at: 1000 }), true);
  }
});
