import assert from "node:assert/strict";
import { test } from "node:test";
import { z } from "zod";
import { paperEntry, paperProceeds } from "../../src/domain/paper-costs.js";
import { replayStrategy } from "../../src/learning/replay.js";
import { signal } from "../../src/strategies/strategy.js";

test("opt-in paper model includes per-leg fee, slippage and fixed costs without overspending",()=>{
  const costs={version:1,feeBps:100,slippageBps:100,fixedCents:5} as const;
  const entry=paperEntry(1000,1,200,costs);
  assert.equal(entry,1020/985);
  assert.equal(paperProceeds(1000,entry!,1,costs),941);
  assert.ok(paperProceeds(1000,entry!,1.2,costs)>1000);
  assert.equal(paperEntry(4,1,0,costs),null);
  assert.equal(paperProceeds(1000,1,1),1000);
});

test("replay uses a later observation for fills and treats a liquidity gap as unexecutable",()=>{
  const strategy=signal("fixture",z.object({}),ctx=>ctx.current.at===1000,"buy",[500,300,3600]);
  const feed=[{at:1000,price:1,liquidity:20000},{at:2000,price:2,liquidity:20000},
    {at:3000,price:3,liquidity:1},{at:4000,price:1.8,liquidity:20000}]
    .map(current=>({current:{...current,source:"fixture",age:900,volume:30000},token:"fixture",chain:"base" as const,rugPassed:true}));
  const result=replayStrategy(strategy,{},feed,{startingCents:10_000,notionalCents:1000,maxCommittedCents:2000,
    minLiquidityUsd:15_000,costs:{version:1,feeBps:0,slippageBps:0,fixedCents:0}});
  assert.equal(result.performance.netCents,-100);
  assert.equal(result.performance.averageHoldMs,2000);
  assert.equal(result.openPositions,0);
});

test("walk-forward selects parameters on training data and evaluates them on a later partition",async()=>{
  const {walkForward}=await import("../../src/learning/walk-forward.js");
  const strategy=signal("fixture",z.object({buyAt:z.number()}),(ctx,p)=>ctx.current.at===p.buyAt,"buy",[500,300,3600]);
  const feed=[{at:1000,price:1},{at:2000,price:1},{at:3000,price:2},{at:4000,price:2},{at:5000,price:3}]
    .map(current=>({current:{...current,liquidity:20000,source:"fixture",age:900,volume:30000},
      token:"fixture",chain:"base" as const,rugPassed:true}));
  const result=walkForward(strategy,[{buyAt:1000},{buyAt:3000}],feed,
    {startingCents:10_000,notionalCents:1000,maxCommittedCents:2000,minLiquidityUsd:15_000,
      costs:{version:1,feeBps:0,slippageBps:0,fixedCents:0}},
    [{trainStart:1000,split:4000,testEnd:6000}],{minTrades:1,maxRealizedDrawdown:0.1})[0]!;
  assert.equal(result.selectedCandidate,0);
  assert.equal(result.training?.performance.netCents,1000);
  assert.equal(result.holdout?.performance.trades,0);
});
