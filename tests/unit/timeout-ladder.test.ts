import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultLadder } from "../../schemas/exit-policy.js";
import type { ExitPolicy } from "../../schemas/exit-policy.js";
import { activeTarget } from "../../src/exits/policy.js";

export const policy: ExitPolicy = { mode: "profit_only", entry_at: 1000, entry_price: 10,
  min_profit_bps_for_exit: 25, timeout_ladder: defaultLadder, max_hold_sec: 3600 };

test("applies ladder targets at exact boundaries and retains the floor at max hold", () => {
  assert.deepEqual([0, 599, 600, 899, 900, 3600].map(sec => activeTarget(policy, policy.entry_at + sec * 1000)),
    [500, 500, 250, 250, 50, 50]);
});
