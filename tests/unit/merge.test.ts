import { strict as assert } from "node:assert";
import { test } from "node:test";
import { merge, REJECTION_TTL_MS, WATCHED_TTL_MS } from "../../src/cache/merge.js";
import { ReconCache } from "../../src/cache/recon-cache.js";
import type { Handoff } from "../../schemas/common.js";
import type { ReconSnapshot } from "../../schemas/recon-snapshot.js";

const target = { chain: "base", token: "token", pair: "pair" } as const;
const identity: Handoff = { run_id: "one", ...target };
const sourced = (value: number, fetched_at = 10) => ({ value, fetched_at, source: "fixture" });
const snapshot: ReconSnapshot = {
  target,
  market: { source_fetched_at: 10, trigger: "vol_spike", price_usd: sourced(2), liquidity_usd: sourced(1000),
    vol_1h_usd: sourced(500), age_sec: sourced(600) },
  security: { source_fetched_at: 12, assessment: "flagged", checks_raw: {}, sources_disagree: false,
    provenance: { goplus: { source: "goplus", fetched_at: 12, ok: true } } },
};

test("preserves source age, flag and measured zero through the exact TTL boundary", () => {
  const merged = merge(identity, { ...snapshot, social: sourced(0, 11) }, 10, 20);
  assert.equal(merged.assessment, "flagged");
  assert.equal(merged.expires_at, 20);
  assert.deepEqual(merged.feed_entry, { ...target, trigger: "vol_spike", liquidity_usd: 1000,
    vol_1h_usd: 500, age_sec: 600, social_score: 0, as_of: 0 });
  assert.deepEqual(merged.gaps, []);
  assert.equal(merge(identity, snapshot, 10, 20).feed_entry?.social_score, null);
});

test("distinguishes stale snapshots, pair mismatch, and fresh market failures", () => {
  assert.equal(merge(identity, snapshot, 10, 21).gap, "stale_recon");
  assert.equal(merge({ ...identity, pair: "other" }, snapshot, 10, 20).gap, "stale_recon");
  assert.equal(merge(identity, { target, market_failed_at: 10 }, 10, 20).gap, "recon_a_missing");
  assert.equal(merge(identity, { target, market_failed_at: 10 }, 10, 21).gap, "stale_recon");
});

test("rejects numeric safety findings without provenance", () => {
  const unsigned = { ...snapshot, security: { ...snapshot.security!, checks_raw: { tax_bps: 2 } } };
  assert.throws(() => merge(identity, unsigned, 10, 13), /recon_provenance_missing/);
});

test("uses watched TTL and remembers a rejection for the token across pairs", () => {
  const cache = new ReconCache();
  cache.track(target, true);
  cache.put(snapshot);
  assert.equal(cache.read(identity, 10 + WATCHED_TTL_MS).stale, false);
  assert.equal(cache.read(identity, 11 + WATCHED_TTL_MS).stale, true);
  cache.reject(target, 12);
  assert.equal(cache.isRejected({ ...target, pair: "other" }, 11 + REJECTION_TTL_MS), true);
  assert.equal(cache.isRejected(target, 12 + REJECTION_TTL_MS), false);
  assert.equal(cache.read(identity, 13).stale, true);
});
