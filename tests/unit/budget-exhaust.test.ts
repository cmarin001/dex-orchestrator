import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture,req,provider } from "../phase3-fixture.js";
import { Router } from "../../src/providers/router.js";
import { BudgetExhaustedError } from "../../src/providers/types.js";
import { Budget } from "../../src/providers/budget.js";
import { join } from "node:path";

test("durable reservations atomically enforce provider and global spend caps",async t=>{
  const f=await fixture(t);
  let calls=0;
  f.settings.budget={...f.settings.budget,dailyUsdCap:1,perProvider:{local:.6}};
  const make=(budget:Budget)=>new Router(new Map([["local",provider("local",async()=>{
    calls++;return {content:"ok",toolCalls:[]};
  },.6)]]),budget);
  const run=(router:Router)=>router.run(f.settings.policy,f.settings.budget,{local:true},{},req.stage,ask=>ask(req));
  const results=await Promise.allSettled([run(make(f.budget)),run(make(f.budget))]);
  assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
  await assert.rejects(run(make(new Budget(join(f.dir,"budget.jsonl")))),BudgetExhaustedError);
  assert.equal(calls,1);
  assert.equal((await f.budget.status(f.settings.budget)).total,.6);
});
