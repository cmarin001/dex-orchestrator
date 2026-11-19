import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultRisk } from "../../schemas/risk-config.js";
import { riskBudget } from "../../src/agents/sizer.js";
import { discover } from "../../src/tools/discovery.js";
import type { DiscoveryScope } from "../../src/tools/discovery.js";

const request: typeof fetch = async (url) => {
  const page = Number(new URL(String(url)).searchParams.get("page"));
  const token = "0x" + String(page).repeat(40);
  return Response.json({ data: [{ attributes: { address: "0x" + String(page + 3).repeat(40),
    pool_created_at: new Date().toISOString(), reserve_in_usd: "1000", volume_usd: { h1: "50" } },
    relationships: { base_token: { data: { id: "base_" + token } } } }] });
};
test("widening a fixture search yields more candidates without changing the sizing gate on the fixed set", async () => {
  const narrow: DiscoveryScope = { max_candidates: 10, triggers: ["new_pair"], sources: [{ chain: "base", dex: "uni", pages: 1 }] };
  const wide: DiscoveryScope = { ...narrow, sources: [{ chain: "base", dex: "uni", pages: 2 }] };
  const before = await discover(narrow, request, undefined, Date.now() + 1000);
  const after = await discover(wide, request, undefined, Date.now() + 1000);
  assert.equal(before.targets.length, 1);
  assert.equal(after.targets.length, 2);
  const gate = (targets: typeof before.targets) => targets.map(x => riskBudget(defaultRisk, 0, 100_000, x.token.includes("1") ? 200 : 0) > 0);
  assert.deepEqual(gate(before.targets), gate(after.targets.slice(0, 1)));
});
