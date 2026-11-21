import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture,provider,req } from "../phase3-fixture.js";
import { Router } from "../../src/providers/router.js";
import { ProviderError } from "../../src/providers/types.js";

test("rate limit mid-tool conversation starts a fresh conversation on the next provider",async t=>{
  const f=await fixture(t);
  const calls:string[]=[];
  let round=0;
  const router=new Router(new Map([
    ["local",provider("local",async()=>{calls.push("local");if(++round===2)throw new ProviderError("rate_limit");
      return {content:"first",toolCalls:[]};})],
    ["deepseek",provider("deepseek",async()=>{calls.push("deepseek");return {content:"second",toolCalls:[]};})],
  ]),f.budget);
  const result=await router.run(f.settings.policy,f.settings.budget,{local:true,deepseek:true},{},req.stage,async ask=>{
    await ask(req);
    return ask(req);
  });
  assert.equal(result.content,"second");
  assert.deepEqual(calls,["local","local","deepseek","deepseek"]);
});
