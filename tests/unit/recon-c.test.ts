import { test } from "node:test";
import assert from "node:assert/strict";
import { reconC } from "../../src/agents/recon-c.js";
import { id, now, mockApi } from "../agent-fixture.js";
test("unavailable social sources yield null and reject measured zero", async (t) => {
  const row = {
    run_id: id.run_id,
    chain: id.chain,
    token: id.token,
    mentions_1h: 0,
    unique_accounts: 0,
    sentiment: "neutral",
    notable_mentions: 0,
    bot_heavy: false,
    social_score: null,
    sources: [],
    as_of: now,
  };
  let output: unknown = row;
  const { call } = mockApi(t, () => ({ rows: [output] }));
  const input = { run_id: id.run_id, chain: id.chain, tokens: [id.token], window_minutes: 60 };
  assert.deepEqual(await reconC(call, id, input, []), [row]);
  output = { ...row, social_score: 0 };
  await assert.rejects(reconC(call, id, input, []));
});

import { pinnedPrompt } from "../agent-fixture.js";
test("reviewed prompt matches the tested contract", () =>
  pinnedPrompt("recon-c-social", "46dd43145f46907b67322e3ab5e984d413d5f0e8295d97e2e2e13c98f9cdfacb"));

test("a successful source with zero results permits a measured score of zero", async (t) => {
  const row = {
    run_id: id.run_id,
    chain: id.chain,
    token: id.token,
    mentions_1h: 0,
    unique_accounts: 0,
    sentiment: "neutral",
    notable_mentions: 0,
    bot_heavy: false,
    social_score: 0,
    sources: ["x"],
    as_of: now,
  };
  const { call } = mockApi(t, () => ({ rows: [row] }));
  const actions = [
    { name: "x_search", description: "configured test source", run: async () => ({ meta: { result_count: 0 } }) },
  ];
  assert.deepEqual(
    await reconC(call, id, { run_id: id.run_id, chain: id.chain, tokens: [id.token], window_minutes: 60 }, actions),
    [row],
  );
});
