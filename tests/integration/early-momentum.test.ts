import assert from "node:assert/strict";
import { test } from "node:test";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { applySetting } from "../../src/mode/config.js";
import { ModeRuntime } from "../../src/mode/runtime.js";
import { StrategyEvidence } from "../../src/strategies/evidence.js";
import { MomentumPositions, managedPolicy } from "../../src/strategies/early-momentum/monitor.js";
import { watchPositions } from "../../src/exits/watcher.js";
import { runCandidate } from "../../src/orchestrator/pipeline.js";
import { earlyMomentumId } from "../../schemas/early-momentum.js";
import { fixture } from "../phase3-fixture.js";
import { id } from "../agent-fixture.js";
import { evidence, route } from "../early-momentum-fixture.js";

test("opt-in paper entry honors risk, journals one fill, and recovers trailing state and cooldown",async t=>{
  const f=await fixture(t,async()=>{throw new Error("Jev, Hermes and reasoning are unavailable");});
  applySetting(f.settings,{type:"strategy",id:earlyMomentumId,settings:{params:{cooldownSec:120}}});
  assert.equal(f.settings.strategies[earlyMomentumId]?.enabled,false);
  for (const s of f.registry.list()) f.settings.strategies[s.id]={enabled:s.id===earlyMomentumId,params:{}};
  f.settings.strategies[earlyMomentumId]!.params={cooldownSec:120};
  const evidencePath=join(f.dir,"evidence.jsonl");
  const at=Date.now();
  const write=async (stamp:number,gross?:number)=>{
    const market={...evidence(stamp),liquidation:gross===undefined?undefined:route(stamp,gross)};
    await writeFile(evidencePath,JSON.stringify({target:{chain:id.chain,token:id.token,pair:id.pair},
      source:"fixture",fetched_at:stamp,sell_simulation:true,early_momentum:market})+"\n");
  };
  await write(at);
  const runtime=new ModeRuntime(f.plane,async()=>{throw new Error("paid AI must stay off");},new StrategyEvidence(evidencePath));
  const momentum=new MomentumPositions([],new StrategyEvidence(evidencePath));
  const pipeline={...f.pipeline,mode:runtime,call:runtime.call,momentumPositions:momentum};
  await runtime.beginCycle(Date.now());
  assert.equal(await runCandidate({...f.snapshot(),sources_disagree:true},pipeline),"skipped");
  const unsafe=f.snapshot();
  assert.equal(await runCandidate({...unsafe,checks_raw:{...unsafe.checks_raw,honeypot_sim_ok:false,
    blacklist_present:true}},pipeline),"skipped");
  assert.equal(await runCandidate(f.snapshot(),{...pipeline,executionMode:"live"}),"skipped");
  const result=await Promise.all([runCandidate(f.snapshot(),pipeline),runCandidate(f.snapshot(),pipeline)]);
  assert.equal(result.filter(x=>x==="paper_fill").length,1,JSON.stringify(f.events.filter(e=>e.status==="skipped")));
  assert.equal(f.events.filter(e=>e.status==="paper_fill").length,1);
  const [position]=pipeline.positions.list();
  assert.ok(position);
  assert.equal(position.cost_cents,998);
  const duplicate=f.snapshot();
  assert.equal(await runCandidate({...duplicate,identity:{...id,pair:"0x"+"3".repeat(40)}},pipeline),"skipped");
  assert.ok(f.events.some(event=>event.gaps.includes("managed_token_already_open")));
  assert.equal(managedPolicy(position.exit_policy)?.tokenAmount,4.95);
  assert.equal(pipeline.equity.markedCapitalCents,100_000-16);

  const highAt=Date.now()+20;
  await write(highAt,1210);
  await momentum.evidence.refresh(highAt);
  const high=await momentum.check(position,highAt,false,f.audit);
  assert.equal(high.state.state,"MOMENTUM_ACTIVE");
  const recovered=new MomentumPositions(f.events,new StrategyEvidence(evidencePath));
  const stopAt=highAt+20;
  await write(stopAt,1120);
  await new Promise(resolve=>setTimeout(resolve,Math.max(1,stopAt-Date.now()+2)));
  const abort=new AbortController();
  const timeout=setTimeout(()=>abort.abort(),1000);
  try {
    await watchPositions(pipeline.positions,pipeline.equity,async event=>{
      await f.audit(event);
      if (event.status==="paper_close") abort.abort();
    },abort.signal,runtime.call,1,new Set(),undefined,undefined,runtime,undefined,undefined,undefined,recovered);
  } finally { clearTimeout(timeout); }
  const close=f.events.find(e=>e.status==="paper_close");
  assert.equal(close?.close?.proceeds_cents,1112);
  assert.equal((close?.detail as {reason:string}).reason,"trailing_stop");
  assert.equal(pipeline.equity.availableCapital,100_114);
  const replay=new MomentumPositions(f.events,new StrategyEvidence(evidencePath));
  const exitedAt=close!.close!.exit_at;
  assert.equal(replay.cooling({...id,pair:"different-pool"},exitedAt+119_999),true);
  assert.equal(replay.cooling(id,exitedAt+120_000),false);
});

test("Jev outage and exhausted budget stay in the quote-based shadow cohort",async t=>{
  const {DecisionShadow}=await import("../../src/decisions/shadow.js");
  let at=Date.now();
  const f=await fixture(t,undefined,()=>at);
  let calls=0;
  let affordable=false;
  const shadow=new DecisionShadow({id:"jev-fixture",async evaluate(){
    calls++;
    throw new Error("offline");
  }},f.audit,{scope:"early_momentum",horizonMs:60_000,labelWindowMs:10_000,notionalCents:998,
    costs:{version:1,feeBps:0,slippageBps:0,fixedCents:0}},new AbortController().signal,async()=>affordable,()=>at);
  shadow.observe(f.snapshot(),"skipped",{observedAt:at,data:evidence(at)});
  await shadow.settled();
  assert.equal(calls,0);
  assert.equal(f.events[0]?.gaps[0],"budget_exhausted");
  at+=60_000;
  shadow.observe(f.snapshot(),"skipped",{observedAt:at,data:{...evidence(at),liquidation:route(at,1100)}});
  await shadow.settled();
  assert.equal((f.events[1]?.detail as {net_cents:number}).net_cents,94);
  at+=1000;
  affordable=true;
  shadow.observe(f.snapshot(),"skipped",{observedAt:at,data:evidence(at)});
  await shadow.settled();
  assert.equal(calls,1);
  assert.equal(f.events[2]?.gaps[0],"decision_unavailable");
  assert.equal(f.pipeline.positions.count,0);
});
