import assert from "node:assert/strict";
import {test} from "node:test";
import {defaultRisk} from "../../schemas/risk-config.js";
import {configuredJevTrading} from "../../src/decisions/composition.js";
import {JevExitRequests} from "../../src/decisions/exit-requests.js";
import {JevDecisionProvider} from "../../src/decisions/jev.js";
import {tradeReview} from "../../src/decisions/paper-entry.js";
import {watchPositions} from "../../src/exits/watcher.js";
import {runCandidate} from "../../src/orchestrator/pipeline.js";
import {Positions} from "../../src/state/positions.js";
import {Equity} from "../../src/state/equity.js";
import {createSigner} from "../../src/wallet/signer.js";
import {createLiveExecution} from "../../src/wallet/live.js";
import {fixture} from "../phase3-fixture.js";
import {id} from "../agent-fixture.js";
import {caps,noWait,walletFixture} from "../wallet-fixture.js";

function jevFixture(actions:string[]) {
  const model="typesafe-ai/jev";
  return new JevDecisionProvider("fixture",[model],500,async (_url,init)=>{
    const {questions:[question],input}=JSON.parse(String(init?.body));
    assert.ok(!input.includes(id.token));
    actions.push(question.name);
    const [yes,no,abstain]=question.choices.map((option:{value:string})=>option.value);
    return Response.json({model,answers:[{name:question.name,type:"choice",choice:yes,confidence:.9,
      probabilities:[{value:yes,probability:.9},{value:no,probability:.05},{value:abstain,probability:.05}]}]});
  });
}

test("confirmed Jev buy and sell actions reach the normal paper ledger",async t=>{
  const f=await fixture(t);
  f.settings.mode={...f.settings.mode,mode:"hybrid"};
  await f.runtime.beginCycle();
  const actions:string[]=[];
  const provider=jevFixture(actions);
  const options={reserve:async()=>true,approvalThreshold:.85,timeoutMs:500};
  const buy=tradeReview(provider,f.audit,options,"buy");
  const sells=new JevExitRequests(tradeReview(provider,f.audit,options,"sell"),()=>f.runtime.allowsJevTrading());
  const pipeline={...f.pipeline,exitMode:"stop_loss" as const,jevBuy:buy};
  assert.equal(await runCandidate(f.snapshot(),pipeline),"paper_fill");
  const abort=new AbortController();
  const timeout=setTimeout(()=>abort.abort(),1000);
  try {
    await watchPositions(pipeline.positions,pipeline.equity,async event=>{
      await f.audit(event);
      if (event.status==="paper_close") abort.abort();
    },abort.signal,pipeline.call,5,new Set(),undefined,undefined,f.runtime,undefined,undefined,
    {mark:async()=>({price_usd:2,source:"fixture"})},undefined,sells);
  } finally {clearTimeout(timeout);}
  assert.deepEqual(actions,["buy","sell"]);
  assert.equal(pipeline.positions.count,0);
  for (const [status,action] of [["paper_fill","buy"],["paper_close","sell"]]) {
    const fill=f.events.find(row=>row.status===status);
    const decision=f.events.find(row=>row.stage==="jev_trade_review" &&
      (row.detail as {action:string}).action===action);
    assert.ok(decision);
    assert.equal((fill?.detail as {decision_id:string}).decision_id,
      (decision.detail as {decision_id:string}).decision_id);
  }
});

test("Jev buy and sell use the armed live executor through a mocked chain",async t=>{
  const f=await fixture(t);
  f.settings.mode={...f.settings.mode,mode:"hybrid"};
  await f.runtime.beginCycle();
  const calls:string[]=[];
  const provider=jevFixture(calls);
  const options={reserve:async()=>true,approvalThreshold:.85,timeoutMs:500};
  let armed=false;
  const prepared:boolean[]=[];
  let sequence=0;
  const signer=createSigner({
    chain:"base",address:async()=>"wallet",
    prepare:async tx=>{
      prepared.push(tx.reduce_only);
      return {simulation:{ok:true,max_fee_native:"1"},sign:async()=>{
        sequence++;
        return {bytes:Uint8Array.of(1),id:"simulated-"+sequence};
      }};
    },
    broadcast:async()=>"simulated-"+sequence,
    receipt:async(tx,{id})=>({status:"confirmed",chain:"base",tx_hash:id,
      amount_in:tx.amount_in,amount_out:tx.min_amount_out}),
  },caps,f.audit,f.events,noWait,()=>armed);
  const live=createLiveExecution({enabled:()=>armed,config:caps,signer,audit:f.audit,journal:f.events,
    positions:f.pipeline.positions,equity:f.pipeline.equity,stable:"usd",stableDecimals:6,usdPerUnit:1,
    decimals:new Map([[id.token,2]])});
  const pipeline={...f.pipeline,exitMode:"stop_loss" as const,executionMode:"live" as const,live,
    jevBuy:tradeReview(provider,f.audit,options,"buy")};
  assert.equal(await runCandidate(f.snapshot(),pipeline),"skipped");
  assert.deepEqual(calls,[]);
  armed=true;
  assert.equal(await runCandidate(f.snapshot(),pipeline),"live_fill");
  const abort=new AbortController();
  const sells=new JevExitRequests(tradeReview(provider,f.audit,options,"sell"),()=>armed);
  const timeout=setTimeout(()=>abort.abort(),1000);
  const stop=f.events.length;
  const watcherAudit=async (event:Parameters<typeof f.audit>[0])=>{
    await f.audit(event);
    if (f.events.slice(stop).some(row=>row.status==="live_close")) abort.abort();
  };
  try {
    await watchPositions(pipeline.positions,pipeline.equity,watcherAudit,abort.signal,pipeline.call,5,
      new Set(),live,async()=>150,f.runtime,undefined,undefined,
      {mark:async()=>({price_usd:2,source:"fixture"})},undefined,sells);
  } finally {clearTimeout(timeout);}
  assert.deepEqual(calls,["buy","sell"]);
  assert.deepEqual(prepared,[false,true]);
  assert.equal(pipeline.positions.count,0);
  assert.ok(f.events.some(row=>row.status==="live_close"));
});

test("a stalled Jev sell review does not delay another position's stop",async t=>{
  const f=await fixture(t);
  f.settings.mode={...f.settings.mode,mode:"hybrid"};
  await f.runtime.beginCycle();
  const policy={mode:"stop_loss" as const,entry_price:2,entry_at:Date.now()-1000,max_hold_sec:3600,
    min_profit_bps_for_exit:25,timeout_ladder:defaultRisk.timeout_ladder,stop_loss_bps:500};
  f.pipeline.positions.record({...id,cost_cents:100,entry_price_usd:2,exit_policy:policy});
  const stop={...id,run_id:"urgent",pair:"other",token:"other"};
  f.pipeline.positions.record({...stop,cost_cents:100,entry_price_usd:2,exit_policy:policy});
  const abort=new AbortController();
  const reviews:string[]=[];
  const sells=new JevExitRequests((order,signal)=>{
    reviews.push(order.identity.run_id);
    return new Promise(resolve=>signal?.addEventListener("abort",()=>resolve(undefined),{once:true}));
  },()=>true);
  const timeout=setTimeout(()=>abort.abort(),1000);
  try {
    await watchPositions(f.pipeline.positions,f.pipeline.equity,async event=>{
      await f.audit(event);
      if (event.status==="paper_close") abort.abort();
    },abort.signal,f.pipeline.call,5,new Set(),undefined,undefined,f.runtime,undefined,undefined,
    {mark:async target=>({price_usd:target.token===stop.token?1.75:2,source:"fixture"})},undefined,sells);
  } finally {clearTimeout(timeout);}
  assert.deepEqual(reviews,[id.run_id]);
  assert.equal(f.events.find(row=>row.status==="paper_close")?.identity?.run_id,stop.run_id);
  assert.equal(f.pipeline.positions.count,1);
});

test("Jev action mode is off by default and live requires an explicit matching mode",async()=>{
  const audit=async()=>{};
  assert.equal(await configuredJevTrading({},"live","unused",audit),undefined);
  const JEV_TRADING=JSON.stringify({approvalThreshold:.9,responseModels:["fixture"],
    dailyBudgetUsd:1,maxCostPerRequestUsd:.01});
  await assert.rejects(configuredJevTrading({JEV_TRADING},"live","unused",audit),/EXECUTION_MODE_MISMATCH/);
});

test("a discretionary live sale cancelled during simulation never reaches signing",async()=>{
  const {audit,journal}=walletFixture();
  let permitted=true;
  let signed=0;
  const openPositions=new Positions();
  const position={...id,cost_cents:100,entry_price_usd:2,live_amount:"50"};
  openPositions.record(position);
  const signer=createSigner({chain:"base",address:async()=>"wallet",
    prepare:async()=>{
      permitted=false;
      return {simulation:{ok:true,max_fee_native:"1"},sign:async()=>{
        signed++;
        return {id:"fixture",bytes:Uint8Array.of(1)};
      }};
    },broadcast:async()=>assert.fail("unexpected broadcast"),
    receipt:async()=>assert.fail("unexpected receipt"),
  },caps,audit,journal,noWait);
  const execution=createLiveExecution({enabled:()=>true,config:caps,signer,audit,journal,positions:openPositions,
    equity:new Equity(10_000),stable:"usd",stableDecimals:6,usdPerUnit:1,decimals:new Map([[id.token,2]])});
  assert.equal(await execution.exit(position,2,150,"manual",()=>permitted),false);
  assert.equal(signed,0);
  assert.equal(openPositions.count,1);
});
