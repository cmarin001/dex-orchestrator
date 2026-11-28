import assert from "node:assert/strict";
import {test} from "node:test";
import {Router} from "../../src/providers/router.js";
import {ProviderError} from "../../src/providers/types.js";
import {fixture,provider,req} from "../phase3-fixture.js";

test("opt-in provider retry reserves spend for each inference attempt and leaves auth failures single-shot",async t=>{
  const f=await fixture(t);
  const policy={...f.settings.policy,order:["fixture"],retryLimit:2};
  let calls=0;
  const model=provider("fixture",async()=>{
    calls++;
    if (calls<3) throw new ProviderError("timeout");
    return {content:"success",toolCalls:[]};
  },.1);
  const router=new Router(new Map([[model.id,model]]),f.budget);
  const response=await router.run(policy,f.settings.budget,{fixture:true},{},req.stage,ask=>ask(req));
  assert.equal(response.content,"success");
  assert.equal(calls,3);
  assert.ok(Math.abs((await f.budget.status(f.settings.budget)).total-.3)<1e-9);
  calls=0;
  const rejected=provider("fixture",async()=>{calls++;throw new ProviderError("authentication");});
  await assert.rejects(new Router(new Map([[rejected.id,rejected]]),f.budget)
    .run(policy,f.settings.budget,{fixture:true},{},req.stage,ask=>ask(req)),/all_providers_down/);
  assert.equal(calls,1);
});
