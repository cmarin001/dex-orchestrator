import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture,provider,req } from "../phase3-fixture.js";
import { runCandidate } from "../../src/orchestrator/pipeline.js";
import { Router } from "../../src/providers/router.js";
import { BudgetExhaustedError } from "../../src/providers/types.js";

test("an exhausted budget degrades AI mode to deterministic strategies for this cycle",async t=>{
  let network=0;
  let assess!:()=>Promise<void>;
  const f=await fixture(t,async()=>{await assess();throw new BudgetExhaustedError();});
  f.settings.mode.mode="ai";
  f.settings.budget.dailyUsdCap=0;
  const local=provider("openai",async()=>{network++;return {content:"",toolCalls:[]};},1);
  const router=new Router(new Map([["openai",local]]),f.budget);
  assess=()=>router.run(f.settings.policy,f.settings.budget,{openai:true},{},req.stage,async ask=>{await ask(req);});
  await f.runtime.beginCycle();
  assert.equal(await runCandidate(f.snapshot(),f.pipeline),"paper_fill");
  assert.equal(network,0);
  assert.ok(f.events.some(e=>e.stage==="mode_degraded"));
});
