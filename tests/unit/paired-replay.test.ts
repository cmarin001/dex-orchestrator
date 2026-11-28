import assert from "node:assert/strict";
import {test} from "node:test";
import {z} from "zod";
import {replayStrategy,type ReplayPoint} from "../../src/learning/replay.js";
import {signal} from "../../src/strategies/strategy.js";

const strategy=signal("fixture",z.strictObject({}),ctx=>ctx.current.at===1000,"buy",[500,300,3600]);
const settings={startingCents:10_000,notionalCents:1000,maxCommittedCents:2000,minLiquidityUsd:15_000,
  costs:{version:1 as const,feeBps:50,slippageBps:20,fixedCents:1}};
function run(review?:ReplayPoint["entryReview"],pair="pool") {
  const feed:ReplayPoint[]=[1000,2000,3000].map((at,index)=>({chain:"base",token:"token",
    pair:index===0?"pool":pair,rugPassed:true,entryReview:index===0?review:undefined,
    current:{at,price:index===2?1.2:1,source:"fixture",age:900,liquidity:30_000,volume:20_000}}));
  return {baseline:replayStrategy(strategy,{},feed,settings),
    reviewed:replayStrategy(strategy,{},feed,settings,{requireEntryReview:true})};
}

test("paired replay uses identical cost rules and accepts only decisions available before execution",()=>{
  const review={version:1,id:"decision-1",decision:"buy",availableAt:1500,expiresAt:2100} as const;
  const allowed=run(review);
  assert.deepEqual(allowed.baseline.performance,allowed.reviewed.performance);
  assert.equal(allowed.reviewed.fillCount,1);
  assert.deepEqual(allowed.reviewed.entryReviews,{approved:1,declined:0,unavailable:0});
  for (const result of [run({...review,availableAt:2100,expiresAt:3000}),run({...review,expiresAt:2000}),
      run({...review,availableAt:900}),run(undefined),run(review,"another-pool")]) {
    assert.equal(result.baseline.fillCount,1);
    assert.equal(result.reviewed.fillCount,0);
    assert.equal(result.reviewed.entryReviews?.unavailable,1);
  }
  assert.equal(run({...review,decision:"abstain"}).reviewed.entryReviews?.declined,1);
});

test("the same recorded review can influence only one entry",()=>{
  const review={version:1,id:"shared-id",decision:"buy",availableAt:1000,expiresAt:3000} as const;
  const feed:ReplayPoint[]=[1000,2000].flatMap(at=>["one","two"].map(token=>({chain:"base",token,
    pair:token,rugPassed:true,entryReview:at===1000?review:undefined,
    current:{at,price:1,source:"fixture",age:900,liquidity:30_000,volume:20_000}})));
  const reviewed=replayStrategy(strategy,{},feed,settings,{requireEntryReview:true});
  assert.equal(reviewed.fillCount,1);
  assert.deepEqual(reviewed.entryReviews,{approved:1,declined:0,unavailable:1});
});
