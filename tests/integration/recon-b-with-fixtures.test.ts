import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import type { Handoff } from "../../schemas/common.js";
import { goPlus } from "../../src/tools/goplus.js";
import { dexScreener } from "../../src/tools/dexscreener.js";
import type { Fetch } from "../../src/tools/dexscreener.js";
import { honeypotIs } from "../../src/tools/honeypot-is.js";
import { rugCheckXyz } from "../../src/tools/rugcheck-xyz.js";

const ethereum: Handoff = {
  run_id: "fixture", chain: "ethereum",
  token: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  pair: "0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc",
};
const paths: Record<string, string> = {
  "api.gopluslabs.io": "goplus/ethereum-usdc",
  "api.honeypot.is": "honeypot-is/ethereum-usdc",
  "api.rugcheck.xyz": "rugcheck/solana-wsol",
  "api.dexscreener.com": "dexscreener/ethereum-weth",
};
const fixtureFetch: Fetch = async (input) => {
  const url = new URL(String(input));
  const fixture = paths[url.hostname];
  assert.ok(fixture);
  return new Response(await readFile(new URL(`../../fixtures/${fixture}.json`, import.meta.url)));
};
test("provider returns unknown on missing GoPlus evidence in the recording", async () => {
  const result = await goPlus(ethereum,fixtureFetch);
  assert.equal(result.assessment, "unknown");
  assert.equal((await honeypotIs(ethereum, fixtureFetch)).assessment, "clear");
});

test("decodes recorded DEX and Solana risk payloads", async () => {
  const wrapped = await dexScreener({ ...ethereum, token: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2" }, fixtureFetch);
  assert.ok(wrapped.price_usd > 0 && wrapped.liquidity_usd > 0);
  const mint = "So11111111111111111111111111111111111111112";
  assert.equal((await rugCheckXyz({ chain: "solana", token: mint, pair: mint }, fixtureFetch)).assessment, "clear");
});

import { reconB } from "../../src/agents/recon-b.js";
import { mockApi, now, provenance } from "../agent-fixture.js";
import { securityEvidence } from "../../src/tools/recon-evidence.js";

test("Recon B rejects a model that supplies missing security evidence for the recorded USDC reports",async t=>{
  const gp=await readFile(new URL("../../fixtures/goplus/ethereum-usdc.json",import.meta.url),"utf8");
  const hp=await readFile(new URL("../../fixtures/honeypot-is/ethereum-usdc.json",import.meta.url),"utf8");
  const evidence=securityEvidence(ethereum,JSON.parse(gp),JSON.parse(hp),null);
  assert.equal(evidence.raw.freeze_auth_disabled,null);
  let result={...ethereum,checks_raw:evidence.raw,provenance,sources_disagree:false,confidence:evidence.confidence,reason:"freeze evidence unavailable"};
  const {call}=mockApi(t,()=>result);
  assert.deepEqual(await reconB(call,ethereum,900,fixtureFetch),result);
  result={...result,checks_raw:{...evidence.raw,freeze_auth_disabled:1}};
  await assert.rejects(reconB(call,ethereum,900,fixtureFetch),/does not match/);
});
