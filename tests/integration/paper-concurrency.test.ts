import assert from "node:assert/strict";
import {test} from "node:test";
import {runCandidate} from "../../src/orchestrator/pipeline.js";
import {fixture} from "../phase3-fixture.js";

test("concurrent attempts for the same paper position persist exactly one fill",{timeout:5000},async t=>{
  const f=await fixture(t);
  let release!:()=>void;
  let arrival!:()=>void;
  let duplicate!:()=>void;
  let writes=0;
  const encountered=new Promise<void>(resolve=>{arrival=resolve;});
  const competingWrite=new Promise<"duplicate">(resolve=>{duplicate=()=>resolve("duplicate");});
  const proceed=new Promise<void>(resolve=>{release=resolve;});
  const pipeline={...f.pipeline,audit:async (event:Parameters<typeof f.audit>[0])=>{
    if (event.status==="paper_fill") {
      if (++writes===1) arrival();
      else duplicate();
      await proceed;
    }
    await f.audit(event);
  }};
  const first=runCandidate(f.snapshot(),pipeline);
  await encountered;
  const second=runCandidate(f.snapshot(),pipeline);
  // Hold the first durable write while the competing workflow reaches its own outcome.
  try {
    const outcome=await Promise.race([second,competingWrite]);
    assert.equal(outcome,"skipped");
  } finally {
    release();
    await Promise.allSettled([first,second]);
  }
  assert.equal(await first,"paper_fill");
  assert.equal(f.events.filter(event=>event.status==="paper_fill").length,1);
});
