import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture,req,provider } from "../phase3-fixture.js";
import { Router } from "../../src/providers/router.js";

test("cost-first config tries local, DeepSeek, Grok and then OpenAI",async t=>{
  const f=await fixture(t);
  const ids=["openai","grok","deepseek","local"];
  const router=new Router(new Map(ids.map(id=>[id,provider(id,async()=>({content:id,toolCalls:[]}))])),f.budget);
  const enabled=Object.fromEntries(ids.map(id=>[id,true]));
  for (const expected of [...ids].reverse()) {
    const result=await router.run(f.settings.policy,f.settings.budget,enabled,{},req.stage,ask=>ask(req));
    assert.equal(result.content,expected);
    enabled[expected]=false;
  }
});
