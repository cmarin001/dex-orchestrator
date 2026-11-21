import { securityProvider, geckoResponse } from "../agent-fixture.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { reconA } from "../../src/agents/recon-a.js";
import { id, market, limits, mockApi } from "../agent-fixture.js";
test("Recon A loads full prompt and calls new pools with a chain-bound network", async (t) => {
  const { call } = mockApi(t, () => ({ rows: [market] }));
  const rows = await reconA(
    call,
    id,
    {
      run_id: id.run_id,
      chain: id.chain,
      modes: ["new_pairs"],
      seen: [],
      config: {
        min_liquidity_usd: limits.min_liquidity_usd,
        min_age_sec: 600,
        min_vol_1h_usd: 5000,
        max_age_sec: 86400,
      },
    },
    async (url) => {
      assert.match(String(url), /networks\/base\/new_pools/);
      return Response.json(geckoResponse);
    },
  );
  assert.deepEqual(rows, [market]);
});

import { pinnedPrompt } from "../agent-fixture.js";
test("reviewed prompt matches the tested contract", () =>
  pinnedPrompt("recon-a-market-intel", "af9653af86d195e699bf116c4c894227d766609dde7f4a187d41fe98ac41fc80"));
