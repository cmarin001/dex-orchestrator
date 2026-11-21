import assert from "node:assert/strict";
import { test } from "node:test";
import { chainRoutingSchema } from "../../schemas/chain-routing.js";
import { memecoinEligible } from "../../src/chain/router.js";
test("Solana memecoin filters honor known launchpads, age and concentration",()=>{
  const cfg=chainRoutingSchema.parse({enabledChains:["solana"],perChainCapitalPct:{solana:1},assetClasses:{solana:["memecoin"]},
    memecoinFilters:{solana:{maxAgeSec:86400,minLiquidityUsd:1,maxLiquidityUsd:1e6,minHolders:10,maxTop10Pct:40,knownLaunchpads:["pump.fun"]}}});
  const facts={ageSec:60,liq:100,liquidityUsd:100,holders:11,top10Pct:30,launchpad:"pump.fun"};
  assert.equal(memecoinEligible(cfg,"solana",facts),true);
  assert.equal(memecoinEligible(cfg,"solana",{...facts,ageSec:86401}),false);
  assert.equal(memecoinEligible(cfg,"solana",{...facts,launchpad:"unverified"}),false);
});
