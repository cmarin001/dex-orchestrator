import assert from "node:assert/strict";
import { test } from "node:test";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { createDashboardApi } from "../../src/dashboard-api/routes.js";
import { ReconCache } from "../../src/cache/recon-cache.js";
import { WorkerControls } from "../../src/control/worker.js";
import { Inbox } from "../../src/control/commands.js";
import { ConfigJournals } from "../../src/control/config-journals.js";
import { ControlPlane } from "../../src/control/plane.js";
import { initialSettings } from "../../src/mode/config.js";
import { fixture,context } from "../phase3-fixture.js";
import { runCandidate } from "../../src/orchestrator/pipeline.js";

test("authenticated Phase 3 controls queue revisions and approve exactly one qualifying trade",async t=>{
  const f=await fixture(t);
  const paths={token:"phase3-test",auditPath:join(f.dir,"audit.jsonl"),riskPath:join(f.dir,"risk.jsonl"),
    inboxPath:join(f.dir,"commands"),budgetPath:join(f.dir,"budget.jsonl"),initialCents:100000,events:async()=>f.events};
  const app=createDashboardApi(paths);
  const worker=new WorkerControls(new Inbox(paths.inboxPath),paths.riskPath,new ReconCache(),f.audit,false,
    f.plane,new ConfigJournals(f.dir,paths.budgetPath));
  const headers={Authorization:"Bearer phase3-test","Content-Type":"application/json"};
  const read=async(path:string)=>(await app.request("/api/v1/"+path,{headers})).json();
  const post=(path:string,input:unknown)=>app.request("/api/v1/"+path,{headers,method:"POST",body:JSON.stringify(input)});
  assert.equal((await app.request("/api/v1/mode")).status,401);
  assert.equal((await read("mode")).mode,"strategies");
  assert.equal((await read("providers")).items.length,4);
  assert.equal((await read("strategies")).items.length,24);
  const update={config:{mode:"human"},reason:"manual review",request_id:"human-mode"};
  assert.equal((await post("mode",update)).status,202);
  assert.equal((await read("mode")).mode,"strategies");
  await worker.drain(f.pipeline.positions);
  assert.equal((await read("mode")).mode,"human");
  assert.equal((await post("mode",update)).status,200);
  assert.match(await readFile(join(f.dir,"mode.jsonl"),"utf8"),/"previous":"strategies","next":"human"/);

  await f.runtime.beginCycle();
  assert.equal(await runCandidate(f.snapshot(),f.pipeline),"skipped");
  const signals=await read("signals");
  const pending=signals.items[0];
  assert.equal(pending.state,"pending");
  assert.equal((await post("controls/approve/"+pending.id,{request_id:"approval"})).status,202);
  await worker.drain(f.pipeline.positions);
  assert.equal((await read("signals")).items[0].state,"approved");
  assert.equal(await runCandidate(f.snapshot(),f.pipeline),"paper_fill");
  assert.equal((await read("signals")).items[0].state,"used");
  const recovered=new ControlPlane(await initialSettings({}),f.registry,f.budget,f.audit);
  for (const row of f.events) recovered.replay(row);
  const recoveredWorker=new WorkerControls(new Inbox(paths.inboxPath),paths.riskPath,new ReconCache(),f.audit,false,recovered);
  for (const row of f.events) recoveredWorker.replay(row);
  assert.equal(recovered.recentSignals()[0]?.state,"used");
  assert.equal(await runCandidate(f.snapshot(),f.pipeline),"skipped");

  const badParams=await post("strategies/volume-spike/params",{params:{minLiq:"bad"},request_id:"bad-params"});
  assert.equal(badParams.status,202);
  await worker.drain(f.pipeline.positions);
  const rejected=await (await post("strategies/volume-spike/params",{params:{minLiq:"bad"},request_id:"bad-params"})).json();
  assert.equal(rejected.state,"rejected");
  assert.equal(f.registry.get("volume-spike")?.evaluate(context)?.side,"buy");
});
