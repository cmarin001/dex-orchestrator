import { securityProvider, geckoResponse } from "../agent-fixture.js";
import { test } from "node:test";
import assert from "node:assert/strict";
import { reconB } from "../../src/agents/recon-b.js";
import { id, security, mockApi } from "../agent-fixture.js";
test("Recon B round trips both EVM actions and validates binary evidence", async (t) => {
  let result: unknown = security;
  const { call } = mockApi(t, () => result);
  const provider: typeof fetch = securityProvider;
  assert.deepEqual(await reconB(call, id, 900, provider), security);
  result = { ...security, checks_raw: { ...security.checks_raw, renounced: 2 } };
  await assert.rejects(reconB(call, id, 900, provider));
});

import { pinnedPrompt } from "../agent-fixture.js";
test("reviewed prompt matches the tested contract", () =>
  pinnedPrompt("recon-b-onchain", "e1601ef3db5bdf502b0e0e7726953b795432d3bf877358d56cbca5780adf0d72"));

test("disagreement preserves unsafe honeypot result and a failed provider cannot supply flags", async (t) => {
  const { call } = mockApi(t, () => result);
  let result = {
    ...security,
    sources_disagree: true,
    confidence: "low",
    checks_raw: { ...security.checks_raw, honeypot_sim_ok: 0 },
  };
  const conflict: typeof fetch = async (url) =>
    String(url).includes("goplus") ? securityProvider(url) : Response.json({ honeypotResult: { isHoneypot: true } });
  assert.deepEqual(await reconB(call, id, 900, conflict), result);
  result = { ...result, checks_raw: { ...result.checks_raw, honeypot_sim_ok: 1 } };
  await assert.rejects(reconB(call, id, 900, conflict));
  await assert.rejects(reconB(call, id, 900, async () => new Response(null, { status: 503 })));
});
