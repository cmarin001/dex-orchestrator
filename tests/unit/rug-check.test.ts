import { test } from "node:test";
import assert from "node:assert/strict";
import { rugCheck } from "../../src/agents/rug-check.js";
import { toRugChecks } from "../../schemas/recon-checks.js";
import { id, scan, rug, raw, mockApi } from "../agent-fixture.js";
test("missing critical mint evidence fails and cannot produce PASS", async (t) => {
  const candidate = { ...scan, checks_raw: toRugChecks({ ...raw, mint_auth_disabled: null }) };
  let result: unknown = {
    ...rug,
    verdict: "FAIL",
    checks: { ...rug.checks, mint_auth: false },
    reason: "ambiguous critical: mint_auth",
  };
  const { call } = mockApi(t, (_, data) => {
    assert.deepEqual(data, candidate);
    return result;
  });
  assert.deepEqual(await rugCheck(call, id, candidate), result);
  result = rug;
  await assert.rejects(rugCheck(call, id, candidate));
});

import { pinnedPrompt } from "../agent-fixture.js";
test("reviewed prompt matches the tested contract", () =>
  pinnedPrompt("rug-check", "ffdc3d9f205ae5007dcdab76e787df11fe9fcc871ee87f690fe9838889a56245"));
