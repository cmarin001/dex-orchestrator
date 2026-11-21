import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture,req,provider } from "../phase3-fixture.js";
import { Router } from "../../src/providers/router.js";
import { ProviderError } from "../../src/providers/types.js";

test("fallback policy blocks a recently failing provider until its health interval",async t=>{
  const f=await fixture(t);
  let now=0,calls=0;
  const router=new Router(new Map([["local",provider("local",async()=>{calls++;throw new ProviderError("timeout");})],
    ["deepseek",provider("deepseek",async()=>({content:"fallback",toolCalls:[]}))]]),f.budget,()=>now);
  const run=()=>router.run(f.settings.policy,f.settings.budget,{local:true,deepseek:true},{},req.stage,ask=>ask(req));
  await run(); await run();
  assert.equal(calls,1);
  now+=60000; await run();
  assert.equal(calls,2);
  f.settings.policy.fallback_on=[];
  now+=60000;
  await assert.rejects(run(),/timeout/);
});
