import assert from "node:assert/strict";
import { test } from "node:test";
import { watchPositions } from "../../src/exits/watcher.js";
import { defaultRisk } from "../../schemas/risk-config.js";
import { fixture } from "../phase3-fixture.js";
import { id } from "../agent-fixture.js";

test("a configured stop loss closes without calling advisory strategy or model code", async t => {
  const f = await fixture(t);
  const abort = new AbortController();
  f.settings.mode={...f.settings.mode,mode:"ai"};
  await f.runtime.beginCycle();
  const exitSignal=f.runtime.exitSignal.bind(f.runtime);
  f.runtime.exitSignal=async (identity,advisory)=>{
    assert.equal(advisory,false,"protective stops may check deterministic guards only");
    return exitSignal(identity,advisory);
  };
  t.mock.method(globalThis, "fetch", async () => Response.json({pairs:[{
    chainId:id.chain, pairAddress:id.pair, baseToken:{address:id.token},
    priceUsd:"0.9", liquidity:{usd:100_000},
  }]}));
  f.pipeline.positions.record({...id,cost_cents:100,entry_price_usd:1,exit_policy:{
    entry_at:Date.now()-1000,entry_price:1,min_profit_bps_for_exit:25,
    timeout_ladder:defaultRisk.timeout_ladder,max_hold_sec:3600,mode:"stop_loss",stop_loss_bps:100,
  }});
  const timeout = setTimeout(() => abort.abort(), 1000);
  try {
    await watchPositions(f.pipeline.positions,f.pipeline.equity,async event => {
      await f.audit(event);
      if (event.stage==="logger") abort.abort();
    },abort.signal,async () => { throw new Error("model unavailable"); },1,new Set(),undefined,undefined,f.runtime);
  } finally { clearTimeout(timeout); }
  assert.equal(f.pipeline.positions.count,0);
  assert.equal(f.events.find(event=>event.status==="paper_close")?.close?.exit_reason,"stop");
  assert.ok(f.events.some(event=>event.stage==="equity-curve"));
});

test("entry refreshes risk after the approval handoff", async t => {
  const f=await fixture(t);
  let reviewed=false;
  f.settings.mode={...f.settings.mode,mode:"ai"};
  await f.runtime.beginCycle();
  f.runtime.authorize=async ()=>{reviewed=true; return true;};
  const { runCandidate }=await import("../../src/orchestrator/pipeline.js");
  const outcome=await runCandidate(f.snapshot(),{...f.pipeline,riskConfig:async ()=>({
    ...defaultRisk,halt_new_entries_dd:reviewed?0:defaultRisk.halt_new_entries_dd,
  })});
  assert.equal(reviewed,true);
  assert.equal(outcome,"skipped");
  assert.equal(f.pipeline.positions.count,0);
});

test("paper execution journals the cost basis and marks a net loss on a flat market",async t=>{
  const f=await fixture(t);
  f.settings.mode={...f.settings.mode,mode:"ai"};
  await f.runtime.beginCycle();
  const {runCandidate}=await import("../../src/orchestrator/pipeline.js");
  const paperCosts={version:1,feeBps:30,slippageBps:50,fixedCents:1} as const;
  const before=f.pipeline.equity.markedCapitalCents;
  assert.equal(await runCandidate(f.snapshot(),{...f.pipeline,paperCosts}),"paper_fill");
  const fill=f.events.find(row=>row.status==="paper_fill")!;
  assert.deepEqual(fill.position?.paper_costs,paperCosts);
  assert.ok(fill.position!.entry_price_usd>f.snapshot().quote!.value);
  assert.ok(f.pipeline.equity.markedCapitalCents<before);
  assert.equal(f.pipeline.equity.availableCapital,before);
});

test("position monitoring accepts an injected mark source while preserving chart source vocabulary",async t=>{
  const f=await fixture(t);
  const abort=new AbortController();
  f.pipeline.positions.record({...id,cost_cents:100,entry_price_usd:1,exit_policy:{
    entry_at:Date.now()-1000,entry_price:1,min_profit_bps_for_exit:25,
    timeout_ladder:defaultRisk.timeout_ladder,max_hold_sec:3600,mode:"stop_loss",stop_loss_bps:100,
  }});
  await watchPositions(f.pipeline.positions,f.pipeline.equity,async event=>{
    await f.audit(event);
    if (event.status==="paper_close") abort.abort();
  },abort.signal,async()=>{throw new Error("reasoning must not run");},1,new Set(),undefined,undefined,
  f.runtime,undefined,undefined,{async mark(target,signal){
    assert.equal(target.pair,id.pair);
    assert.equal(signal,abort.signal);
    return {price_usd:0.9,source:"fixture"};
  }});
  assert.equal(f.pipeline.positions.count,0);
  assert.equal((f.events.find(row=>row.stage==="position_mark")?.detail as {source:string}).source,"aggregated");
});
