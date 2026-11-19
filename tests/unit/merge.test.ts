import { strict as assert } from "node:assert";
import { test } from "node:test";
import { merge } from "../../src/cache/merge.js";
import type { Handoff } from "../../schemas/common.js";

const identity: Handoff = { run_id: "one", chain: "base", token: "token", pair: "pair" };
const market = { observedAt: 10, value: { price_usd: 2, liquidity_usd: 1000, summary: "" } };
const security = { observedAt: 12, value: { assessment: "flagged" as const, reasons: ["flag"] } };
const ttl = { marketMs: 10, securityMs: 20 };

test("preserves a flag and expires at the earliest mandatory observation", () => {
  const merged = merge(identity, market, security, undefined, ttl, 13);
  assert.equal(merged.security?.assessment, "flagged");
  assert.equal(merged.expires_at, 20);
  assert.deepEqual(merged.gaps, []);
});

test("stale market observation becomes an explicit gap", () => {
  const merged = merge(identity, market, security, undefined, ttl, 20);
  assert.equal(merged.market, null);
  assert.equal(merged.expires_at, null);
  assert.deepEqual(merged.gaps, ["market_missing_or_stale"]);
});
