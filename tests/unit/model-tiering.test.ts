import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture,provider,req } from "../phase3-fixture.js";
import { Router } from "../../src/providers/router.js";

test("model tier reaches both budget estimation and the stage completion",async t=>{
  const f=await fixture(t);
  const p=provider("openai",async call=>({content:call.model ?? null,toolCalls:[]}));
  const observed:Array<string|undefined>=[];
  p.estimateCost=call=>{observed.push(call.model);return 0;};
  const router=new Router(new Map([["openai",p]]),f.budget);
  const invoke=(stage:string)=>router.run(f.settings.policy,f.settings.budget,{openai:true},f.settings.tiers,stage,ask=>ask({...req,stage}));
  assert.equal((await invoke("scanner")).content,"gpt-4o-mini");
  assert.equal((await invoke("rug-check")).content,"gpt-4o");
  assert.deepEqual(observed,["gpt-4o-mini","gpt-4o"]);
});
