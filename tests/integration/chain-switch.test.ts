import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "../phase3-fixture.js";
import { runCandidate } from "../../src/orchestrator/pipeline.js";
import { chainRoutingSchema } from "../../schemas/chain-routing.js";

test("changing eligibility leaves positions on previous chains in the ledger",async t=>{
  const f=await fixture(t);
  assert.equal(await runCandidate(f.snapshot(),f.pipeline),"paper_fill");
  f.settings.chain=chainRoutingSchema.parse({enabledChains:["solana"],perChainCapitalPct:{solana:1},
    assetClasses:{solana:["memecoin"]},memecoinFilters:{solana:f.settings.chain.memecoinFilters.base}});
  await f.runtime.beginCycle();
  assert.equal(f.runtime.cap(f.snapshot().identity,f.pipeline.equity,f.pipeline.positions),0);
  assert.equal(f.pipeline.positions.count,1);
  f.settings.chain=chainRoutingSchema.parse({});
  await f.runtime.beginCycle();
  assert.ok(f.runtime.cap(f.snapshot().identity,f.pipeline.equity,f.pipeline.positions)>0);
  assert.equal(f.pipeline.positions.count,1);
});
