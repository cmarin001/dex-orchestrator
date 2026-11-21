import assert from "node:assert/strict";
import { test } from "node:test";
import { chainRoutingSchema } from "../../schemas/chain-routing.js";
import { allocation } from "../../src/chain/router.js";
test("capital allocations sum to at most one and Base is the only default chain",()=>{
  const defaults=chainRoutingSchema.parse({});
  assert.deepEqual(defaults.enabledChains,["base"]);
  assert.equal(allocation(defaults,"base"),1);
  assert.equal(allocation(defaults,"solana"),0);
  assert.equal(chainRoutingSchema.safeParse({enabledChains:["base","solana"],perChainCapitalPct:{base:.6,solana:.5}}).success,false);
  assert.equal(chainRoutingSchema.safeParse({enabledChains:["bitcoin"],perChainCapitalPct:{bitcoin:1}}).success,false);
});
