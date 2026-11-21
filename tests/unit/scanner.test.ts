import { test } from "node:test";
import assert from "node:assert/strict";
import { scanner } from "../../src/agents/scanner.js";
import { id, feed, scan, limits, mockApi } from "../agent-fixture.js";
test("Scanner rejects reversed ratio ranking, filters seen and thin pools, accepts empty feed", async (t) => {
  const second = { ...feed, token: "second", liquidity_usd: 30000, vol_1h_usd: 15000 };
  const seen = { ...feed, token: "seen" },
    thin = { ...feed, token: "thin", liquidity_usd: 100 };
  const rows = [
    { ...scan, ...second },
    { ...scan, rank_score: 2 },
    { ...scan, ...seen, skipped: true, rank_score: 0, reason: "dedup" },
    { ...scan, ...thin, skipped: true, rank_score: 0, reason: "liquidity" },
  ];
  let output = rows;
  const { call } = mockApi(t, () => ({ rows: output }));
  const input = { run_id: id.run_id, feed: [feed, second, seen, thin], config: limits, seen: ["seen"] };
  assert.deepEqual(await scanner(call, id, input), rows);
  output = rows.map((r, i) => (i < 2 ? { ...r, rank_score: 2 - i } : r));
  await assert.rejects(scanner(call, id, input));
  output = [];
  assert.deepEqual(await scanner(call, id, { ...input, feed: [] }), []);
});

import { pinnedPrompt } from "../agent-fixture.js";
test("reviewed prompt matches the tested contract", () =>
  pinnedPrompt("scanner", "4a23236e7ab88dcae5f373e942da55f17a262db93a6755eed9b2f1ef656bb8d0"));

test("equal ratios rank deeper liquidity first and missing thresholds are rejected", async (t) => {
  const deeper = { ...feed, token: "deeper", liquidity_usd: feed.liquidity_usd * 2, vol_1h_usd: feed.vol_1h_usd * 2 };
  let rows = [
    { ...scan, ...deeper },
    { ...scan, rank_score: 2 },
  ];
  const { call } = mockApi(t, () => ({ rows }));
  const input = { run_id: id.run_id, feed: [feed, deeper], config: limits, seen: [] };
  assert.deepEqual(await scanner(call, id, input), rows);
  rows = [scan, { ...scan, ...deeper, rank_score: 2 }];
  await assert.rejects(scanner(call, id, input));
  assert.throws(() => scanner(call, id, { ...input, config: { ...limits, min_age_sec: undefined! } }));
});
