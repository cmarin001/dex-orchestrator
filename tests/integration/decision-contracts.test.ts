import assert from "node:assert/strict";
import { test } from "node:test";
import { JevDecisionProvider } from "../../src/decisions/jev.js";
import { DecisionShadow } from "../../src/decisions/shadow.js";
import { MockDecisionProvider } from "../../src/decisions/local.js";
import { entryDecisionGate } from "../../src/decisions/gate.js";
import type { DecisionRequest } from "../../src/decisions/contract.js";
import { evaluateShadow } from "../../src/learning/calibration.js";
import { runCandidate } from "../../src/orchestrator/pipeline.js";
import { fixture } from "../phase3-fixture.js";

const request:DecisionRequest={input:"fixture",questions:[
  {id:"predicate",type:"predicate",instructions:"Is the condition true?"},
  {id:"choice",type:"choice",instructions:"Pick one",choices:["A","B"]},
  {id:"score",type:"score",instructions:"Rate examples",levels:["low","high"]},
  {id:"refused",type:"predicate",instructions:"Refuse this"},
]};
const model="typesafe-ai/jev";
const response={model,answers:[
  {name:"predicate",type:"predicate",probability:0.7},
  {name:"choice",type:"choice",choice:"A",confidence:0.5,probabilities:[{value:"A",probability:0.7},{value:"B",probability:0.3}]},
  {name:"score",type:"score",score:0.4,confidence:0.8,probabilities:[{label:"low",value:0,probability:0.6},{label:"high",value:1,probability:0.4}]},
  {name:"refused",type:"refusal"},
]};

test("Jev Gateway decision fixtures validate choice, score, predicate and refusal",async()=>{
  const provider=new JevDecisionProvider("fixture",[model],500,async(url,init)=>{
    assert.equal(url,"https://ai-gateway.vercel.sh/v1/decisions");
    assert.equal(init?.redirect,"error");
    const body=JSON.parse(String(init?.body));
    assert.equal(body.model,model);
    assert.equal(body.input,request.input);
    assert.deepEqual(body.questions[1].choices,[{value:"A"},{value:"B"}]);
    assert.deepEqual(body.questions[2].levels,[{label:"low"},{label:"high"}]);
    return Response.json(response);
  });
  const result=await provider.evaluate(request);
  assert.deepEqual(result.answers.map(item=>item.type),["predicate","choice","score","abstention"]);
  assert.equal(result.answers[0]?.type==="predicate" && result.answers[0].probability,0.7);
  assert.equal(result.costUsd,undefined);
});

test("Jev rejects unexpected model versions, missing or misnamed answers and inconsistent distributions",async()=>{
  for (const payload of [
    {...response,model:"unexpected"},
    {...response,answers:response.answers.slice(1)},
    {...response,answers:[{...response.answers[0],name:"unexpected"},...response.answers.slice(1)]},
    {...response,answers:[response.answers[0],{...response.answers[1],choice:"B"},...response.answers.slice(2)]},
    {...response,answers:[...response.answers.slice(0,2),{...response.answers[2],score:0.6},response.answers[3]]},
  ]) {
    const provider=new JevDecisionProvider("fixture",[model],500,async()=>Response.json(payload));
    await assert.rejects(provider.evaluate(request),/schema_mismatch/);
  }
});

test("a required decision outage prevents entry after mandatory Rug Check",async t=>{
  const f=await fixture(t);
  f.settings.mode={...f.settings.mode,mode:"ai"};
  await f.runtime.beginCycle();
  const gate=entryDecisionGate({id:"fixture", async evaluate(){throw new Error("offline");}},f.audit,100_000);
  assert.equal(await runCandidate(f.snapshot(),{...f.pipeline,entryDecision:gate}),"skipped");
  assert.deepEqual(f.events.map(row=>row.stage),["scanner","rug-check","decision_gate","pipeline"]);
  assert.equal(f.pipeline.positions.count,0);
});

test("shadow labels skipped candidates after the horizon and keeps model calls outside entry",async t=>{
  let now=1_800_000_000_000;
  const f=await fixture(t,undefined,()=>now);
  let calls=0;
  const provider=new MockDecisionProvider(r=>{
    calls++;
    assert.equal(r.input.includes(f.snapshot().identity.token),false);
    return [{id:"positive_net_return",type:"predicate",probability:0.75}];
  });
  const costs={version:1,feeBps:30,slippageBps:50,fixedCents:1} as const;
  const shadow=new DecisionShadow(provider,f.audit,{costs,horizonMs:60000,labelWindowMs:5000,notionalCents:1000},
    new AbortController().signal,async()=>true,()=>now);
  const cutoff=now;
  shadow.observe(f.snapshot(),"skipped");
  assert.equal(calls,0);
  await shadow.settled();
  now+=60_000;
  shadow.observe(f.snapshot(),"skipped");
  await shadow.settled();
  assert.equal(calls,1);
  const summary=evaluateShadow(f.events,cutoff,0.5);
  assert.equal(summary.holdout,1);
  assert.equal(summary.raw.confusion.fp,1);
  assert.ok(summary.raw.modeledNetCents<0);
  assert.equal(summary.raw.baselineNetCents,0);
});

test("shadow can use its deterministic baseline through configuration without a Gateway credential",async t=>{
  const {configuredShadow}=await import("../../src/decisions/composition.js");
  const {readJournal}=await import("../../src/logging/logger.js");
  const {join}=await import("node:path");
  const f=await fixture(t);
  const auditPath=join(f.dir,"audit.jsonl");
  const path=join(f.dir,"decisions.jsonl");
  const env={DECISION_SHADOW:JSON.stringify({provider:"deterministic",path,horizonMs:60_000,labelWindowMs:20_000,
    minLiquidityUsd:90_000,notionalCents:1000,costs:{version:1,feeBps:30,slippageBps:30,fixedCents:1}})};
  const signal=new AbortController().signal;
  const engine=await configuredShadow(env,auditPath,signal);
  assert.ok(engine);
  engine.observe(f.snapshot(),"skipped");
  await engine.settled();
  const [row]=await readJournal(path);
  assert.equal(row?.status,"ok");
  assert.equal((row?.detail as {provider:string}).provider,"deterministic");
  await assert.rejects(configuredShadow(env,path,signal),/SHADOW_JOURNAL_MUST_BE_SEPARATE/);
  assert.equal(await configuredShadow({},auditPath,signal),undefined);
});

test("Jev distinguishes rate limits, authentication failures and cancelled requests",async()=>{
  const limited=new JevDecisionProvider("fixture",[model],500,async()=>new Response(null,{status:429,headers:{"retry-after":"2"}}));
  await assert.rejects(limited.evaluate(request),{message:"rate_limit",retryAfterMs:2000});
  const denied=new JevDecisionProvider("fixture",[model],500,async()=>new Response(null,{status:401}));
  await assert.rejects(denied.evaluate(request),{message:"authentication"});
  const controller=new AbortController();
  controller.abort();
  await assert.rejects(limited.evaluate(request,controller.signal),{message:"cancelled"});
});
