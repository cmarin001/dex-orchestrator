import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import { fixture } from "../phase3-fixture.js";
import { id,securityProvider } from "../agent-fixture.js";
import { ReconCache } from "../../src/cache/recon-cache.js";
import { refreshRecon } from "../../src/orchestrator/recon-refresh.js";
import { runLoop } from "../../src/orchestrator/loop.js";

test("strategies runs real Recon, scanner, safety, sizing and paper fill with zero model calls",async t=>{
  let modelCalls=0;
  const f=await fixture(t,async()=>{modelCalls++;throw new Error("model requested");});
  assert.equal(f.settings.mode.mode,"strategies");
  assert.deepEqual(f.settings.chain.enabledChains,["base"]);
  assert.ok(Object.values(f.settings.providers).every(value=>!value));
  const at=Date.now();
  t.mock.method(globalThis,"fetch",async (url:unknown,init:RequestInit)=>{
    if (String(url).includes("api.geckoterminal.com")) {
      return Response.json({data:[{attributes:{address:id.pair,reserve_in_usd:"100000",
        volume_usd:{h1:"20000"},pool_created_at:new Date(at-900_000).toISOString()},
        relationships:{base_token:{data:{id:"base_"+id.token}}}}]});
    }
    if (String(url).includes("api.dexscreener.com")) return Response.json({pairs:[{chainId:"base",
      pairAddress:id.pair,baseToken:{address:id.token},priceUsd:"2",marketCap:10000,volume:{h1:20000,h24:24000},liquidity:{usd:100000}}]});
    return securityProvider(url as string,init);
  });
  const cache=new ReconCache();
  const options={targets:[id],intervalMs:5,breakerFailures:1,breakerCooldownMs:1};
  const reconAbort=new AbortController();
  const decisionAbort=new AbortController();
  const pipeline={...f.pipeline,audit:async (event:Parameters<typeof f.audit>[0])=>{
    await f.audit(event);
    if (event.stage==="recon") reconAbort.abort();
    if (event.status==="paper_fill") setImmediate(()=>decisionAbort.abort());
  }};
  await refreshRecon(options,pipeline,cache,reconAbort.signal);
  assert.equal(cache.read(id).stale,false);
  const timeout=setTimeout(()=>decisionAbort.abort(),300);
  try { await runLoop(options,pipeline,decisionAbort.signal,cache); } finally { clearTimeout(timeout); }
  assert.equal(modelCalls,0);
  assert.equal(f.pipeline.positions.count,1);
  assert.equal(f.pipeline.positions.list()[0]!.strategy_id,"volume-spike");
  assert.ok(f.events.some(e=>e.stage==="strategy_signal"));
  assert.ok(f.events.some(e=>e.stage==="logger" && e.status==="ok"));
});

test("the executable worker boots and fills with no provider credentials in its environment",async t=>{
  const {spawn}=await import("node:child_process");
  const {join}=await import("node:path");
  const {setTimeout:sleep}=await import("node:timers/promises");
  const {readJournal}=await import("../../src/logging/logger.js");
  const f=await fixture(t);
  const auditPath=join(f.dir,"worker-audit.jsonl");
  const worker=spawn(process.execPath,["--import","tsx","--import","./tests/phase3-market-preload.ts","src/index.ts"],{
    env:{...process.env,LOG_LEVEL:"silent",AUDIT_PATH:auditPath,CONTROL_INBOX_PATH:join(f.dir,"worker-inbox"),
      RISK_CONFIG_PATH:join(f.dir,"risk.jsonl"),BUDGET_PATH:join(f.dir,"budget.jsonl"),OPERATING_MODE:"",
      MODEL_PROVIDERS:"",MODEL_PROVIDER_POLICY:"{}",EXECUTION_MODE:"paper",ENABLE_DISCOVERY:"false",LOOP_INTERVAL_MS:"15",
      WATCHLIST:JSON.stringify([{chain:id.chain,token:id.token,pair:id.pair}]),OPENAI_API_KEY:"",
      XAI_API_KEY:"",DEEPSEEK_API_KEY:"",STRATEGY_EVIDENCE_PATH:""},
    stdio:["ignore","ignore","pipe"],
  });
  const closed=once(worker,"close");
  let stderr="";
  worker.stderr.on("data",chunk=>{stderr+=String(chunk);});
  try {
    const end=Date.now()+6_000;
    let filled=false;
    while (Date.now()<end && worker.exitCode===null) {
      const journal=await readJournal(auditPath,true);
      filled=journal.some(row=>row.status==="paper_fill");
      if (filled) break;
      await sleep(40);
    }
    assert.equal(filled,true,stderr);
    assert.equal(stderr,"");
  } finally {
    if (worker.exitCode===null) worker.kill();
    await closed;
  }
});
