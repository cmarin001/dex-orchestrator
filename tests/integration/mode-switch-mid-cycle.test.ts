import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "../phase3-fixture.js";
import { localAgent } from "../../src/mode/local-agent.js";

test("configuration changes apply at the next cycle without switching the active stage actor mid-call",async t=>{
  let selected=0;
  const f=await fixture(t,req=>{selected++;return localAgent(req);});
  const request={prompt:"fixture",schema:(await import("zod")).z.literal("ok"),
    identity:(await import("../agent-fixture.js")).id,data:null,local:()=>"ok",validate:()=>true};
  f.settings.mode.mode="ai";
  await f.runtime.call(request);
  assert.equal(selected,0);
  await f.runtime.beginCycle();
  await f.runtime.call(request);
  assert.equal(selected,1);
});
