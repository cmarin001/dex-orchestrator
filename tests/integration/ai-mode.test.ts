import assert from "node:assert/strict";
import { test } from "node:test";
import { fixture } from "../phase3-fixture.js";
import { localAgent } from "../../src/mode/local-agent.js";
import { runCandidate } from "../../src/orchestrator/pipeline.js";

test("AI mode selects the model for the full approved pipeline",async t=>{
  const calls:string[]=[];
  const f=await fixture(t,request=>{calls.push(request.prompt);return localAgent(request);});
  f.settings.mode.mode="ai";
  await f.runtime.beginCycle();
  assert.equal(await runCandidate(f.snapshot(),f.pipeline),"paper_fill");
  assert.ok(calls.includes("sizer") && calls.includes("executor") && calls.includes("logger"));
});
