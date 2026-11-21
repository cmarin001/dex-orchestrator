import { mkdtemp,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestContext } from "node:test";
import { Equity } from "../src/state/equity.js";
import { Positions } from "../src/state/positions.js";
import { ControlPlane } from "../src/control/plane.js";
import { initialSettings } from "../src/mode/config.js";
import { Registry } from "../src/strategies/registry.js";
import { Budget } from "../src/providers/budget.js";
import { localAgent } from "../src/mode/local-agent.js";
import { ModeRuntime } from "../src/mode/runtime.js";
import { merge } from "../src/cache/merge.js";
import { toRugChecks } from "../schemas/recon-checks.js";
import { id, raw } from "./agent-fixture.js";
import type { Audit } from "../src/logging/logger.js";
import type { JournalEvent } from "../src/logging/types.js";
import type { CallAgent } from "../src/agents/call.js";
import type { StrategyContext } from "../src/strategies/strategy.js";
import type { CompletionRequest, ModelProvider } from "../src/providers/types.js";

export const observation = {source:"fixture",at:1_800_000_000_000,price:2,age:900,liquidity:100000,volume:20000,volume24h:24000};
export const context: StrategyContext = {token:id.token,chain:"base",current:observation,history:[]};
export const req: CompletionRequest ={stage:"scanner",system:"Immutable JSON instructions",schema:{type:"object"},tools:[],
  messages:[{role:"user",content:"first"}],maxTokens:100};
export function provider(id:string, complete:ModelProvider["complete"], estimate=0):ModelProvider {
  return {id,capabilities:{structuredOutputs:true,tools:true,maxContextTokens:64000,costPerMTokIn:1,
    costPerMTokOut:1,cacheDiscount:.5},complete,estimateCost:()=>estimate,health:async()=>({ok:true,latencyMs:1})};
}

export async function fixture(t:TestContext, model:CallAgent=localAgent, clock = Date.now) {
  const dir=await mkdtemp(join(tmpdir(),"dex-phase3-"));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  const settings=await initialSettings({});
  const events:JournalEvent[]=[];
  const audit:Audit=async event=>{events.push({...event,at:new Date(clock()).toISOString()});};
  const budget=new Budget(join(dir,"budget.jsonl"),clock);
  const registry=new Registry();
  const plane=new ControlPlane(settings,registry,budget,audit,clock);
  const runtime=new ModeRuntime(plane,model);
  const positions=new Positions(),equity=new Equity(100000);
  const f=(value:number)=>({value,source:"fixture",fetched_at:clock()});
  const snapshot = () => merge(id,{target:id,market:{source_fetched_at:clock(),trigger:"new_pair",
    price_usd:f(2),age_sec:f(900),vol_1h_usd:f(20000),vol_24h_usd:f(24000),liquidity_usd:f(100000)},
    security:{assessment:"clear",source_fetched_at:clock(),checks_raw:toRugChecks(raw),sources_disagree:false,
      provenance:Object.fromEntries(["holder_count","tax_bps","holder_top10_pct"].map(k=>[k,{source:"fixture",fetched_at:clock()}]))}},undefined,clock());
  const pipeline={call:runtime.call,mode:runtime,positions,equity,audit,maxPositionBps:100,maxOpenPositions:3,now:clock};
  return {dir,settings,events,audit,budget,registry,plane,runtime,pipeline,snapshot};
}
