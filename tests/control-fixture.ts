import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { defaultRisk } from "../schemas/risk-config.js";
import { ReconCache } from "../src/cache/recon-cache.js";
import { Inbox } from "../src/control/commands.js";
import { createControl } from "../src/control/service.js";
import { WorkerControls } from "../src/control/worker.js";
import { fileAudit } from "../src/logging/logger.js";
import { Positions } from "../src/state/positions.js";

export const target = {chain:"base",token:"0x" + "1".repeat(40),pair:"0x" + "2".repeat(40)} as const;
export const identity = {...target,run_id:"fixture-run"};
export const config = {...defaultRisk,max_slippage_bps:125};

export async function controlFixture(t: TestContext, live = false) {
  const dir = await mkdtemp(join(tmpdir(),"dex-controls-"));
  t.after(() => rm(dir,{recursive:true,force:true}));
  const paths = {auditPath:join(dir,"audit.jsonl"),riskPath:join(dir,"risk.jsonl"),inboxPath:join(dir,"inbox")};
  const audit = fileAudit(paths.auditPath);
  const cache = new ReconCache();
  const inbox = new Inbox(paths.inboxPath);
  const makeWorker = () => new WorkerControls(inbox,paths.riskPath,cache,audit,live);
  const positions = new Positions();
  const timestamp = Date.now();
  const position = {...identity,cost_cents:1000,entry_price_usd:2,exit_policy:{
    mode:"profit_only" as const, entry_at:timestamp, entry_price:2,
    min_profit_bps_for_exit:100, max_hold_sec:3600, timeout_ladder:defaultRisk.timeout_ladder,
  }};
  positions.record(position);
  await audit({stage:"executor",status:"paper_fill",position,identity,gaps:[]});
  await audit({stage:"position_mark",status:"ok",identity,gaps:[],detail:{t:timestamp,price:3,source:"dexscreener"}});
  await audit({stage:"equity-curve",status:"ok",gaps:[],detail:{
    as_of:Math.floor(timestamp/1000),equity_usd:1000,drawdown_pct:0,win_rate:0,expectancy_usd:0,trades_closed:0,
  }});
  await audit({stage:"worker_lifecycle",status:"ok",gaps:[],detail:"running"});
  await audit({stage:"worker_cycle",status:"ok",gaps:[],detail:{watched:[target],breaker_until:null}});
  if (live) await audit({stage:"execution_mode",status:"ok",gaps:[],detail:{mode:"live",chain:"base"}});
  const worker = makeWorker();
  return {paths,cache,worker,makeWorker,drain:()=>worker.drain(positions),control:createControl(paths)};
}
