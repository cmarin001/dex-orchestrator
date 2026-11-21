import assert from "node:assert/strict";
import { test } from "node:test";
import { toRugChecks } from "../../schemas/recon-checks.js";

const flags = [
  "renounced",
  "mint_auth_disabled",
  "freeze_auth_disabled",
  "lp_locked_or_burned",
  "honeypot_sim_ok",
  "blacklist_present",
  "deployer_rugged_before",
] as const;

test("Recon B flags preserve missing evidence and reject coercion", () => {
  const evidence = Object.fromEntries(flags.map((key) => [key, null]));
  const raw = { ...evidence, tax_bps: 0, holder_count: 42, holder_top10_pct: null };
  for (const key of flags) {
    for (const [value, expected] of [
      [0, false],
      [1, true],
      [null, null],
    ] as const) {
      const result = toRugChecks({ ...raw, [key]: value });
      assert.equal(result[key], expected);
      assert.equal(result.tax_bps, 0);
      assert.equal(result.holder_count, 42);
      assert.equal(result.holder_top10_pct, null);
    }
    for (const invalid of [2, true, "1", undefined]) assert.throws(() => toRugChecks({ ...raw, [key]: invalid }));
  }
});
