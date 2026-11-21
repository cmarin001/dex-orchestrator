import { randomUUID } from "node:crypto";
import { z } from "zod";
import { phase3Command } from "../../schemas/control-plane.js";
import { modeConfigSchema } from "../../schemas/mode-config.js";
import { chainRoutingSchema } from "../../schemas/chain-routing.js";
import { budgetSchema } from "../../schemas/budget.js";
import type { JournalEvent } from "../logging/types.js";
import { Budget } from "../providers/budget.js";
import { Registry } from "../strategies/registry.js";
import { initialSettings } from "../mode/config.js";
import { ControlPlane } from "./plane.js";
import { commandSchema, requestKey, type Inbox } from "./commands.js";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/);
const key = {request_id:requestKey.optional()};
export const input = {
  id:z.strictObject({id}),
  mode:z.strictObject({...key,config:modeConfigSchema,reason:z.string().min(1).max(200)}),
  chain:z.strictObject({...key,config:chainRoutingSchema}),
  budget:z.strictObject({...key,config:budgetSchema}),
  provider:z.strictObject({...key,id}),
  strategy:z.strictObject({...key,id}),
  params:z.strictObject({...key,id,params:z.record(z.string(),z.unknown())}),
  reload:z.strictObject(key),
  signal:z.strictObject({...key,id}),
};
export const reads = ["providers","strategies","mode","chain","budget","signals"] as const;
type Resource=typeof reads[number];
export const changes={
  set_mode:{schema:input.mode,action:(v:z.infer<typeof input.mode>)=>({type:"mode",config:v.config,reason:v.reason})},
  set_chain_routing:{schema:input.chain,action:(v:z.infer<typeof input.chain>)=>({type:"chain",config:v.config})},
  set_budget:{schema:input.budget,action:(v:z.infer<typeof input.budget>)=>({type:"budget",config:v.config})},
  enable_provider:{schema:input.provider,action:(v:z.infer<typeof input.provider>)=>({type:"provider",id:v.id,enabled:true})},
  disable_provider:{schema:input.provider,action:(v:z.infer<typeof input.provider>)=>({type:"provider",id:v.id,enabled:false})},
  enable_strategy:{schema:input.strategy,action:(v:z.infer<typeof input.strategy>)=>({type:"strategy",id:v.id,settings:{enabled:true}})},
  disable_strategy:{schema:input.strategy,action:(v:z.infer<typeof input.strategy>)=>({type:"strategy",id:v.id,settings:{enabled:false}})},
  update_strategy_params:{schema:input.params,action:(v:z.infer<typeof input.params>)=>({type:"strategy",id:v.id,settings:{params:v.params}})},
  reload_strategies:{schema:input.reload,action:()=>({type:"reload"})},
  approve_signal:{schema:input.signal,action:(v:z.infer<typeof input.signal>)=>({type:"signal",id:v.id,approve:true})},
  reject_signal:{schema:input.signal,action:(v:z.infer<typeof input.signal>)=>({type:"signal",id:v.id,approve:false})},
} as const;
export type Change=keyof typeof changes;

export function createPhase3Api(events:()=>Promise<JournalEvent[]>,inbox:Inbox,budgetPath:string) {
  const budget=new Budget(budgetPath);
  return {
    async read(resource:Resource,item?:string) {
      const journal=await events();
      const settings=await initialSettings(process.env);
      const registry=new Registry();
      await registry.reload();
      const plane=new ControlPlane(settings,registry,budget,async()=>{throw new Error("Read-only projection");});
      for (const row of journal) plane.replay(row);
      if (resource==="mode") return settings.mode;
      if (resource==="chain") return settings.chain;
      if (resource==="budget") return {config:settings.budget,...await budget.status(settings.budget)};
      if (resource==="signals") return {items:plane.recentSignals()};
      if (resource==="strategies") {
        const recent=new Map<string,boolean[]>();
        for (const event of journal) {
          const name=event.close && event.position?.strategy_id;
          if (!name || !event.close || !event.position) continue;
          const trades=recent.get(name) ?? [];
          recent.set(name,[...trades.slice(-49),event.close.proceeds_cents>event.position.cost_cents]);
        }
        const result=registry.list().filter(s=>!item||s.id===item).map(s=>{
          const {evaluate,factor,params,...meta}=s;
          const samples=recent.get(s.id) ?? [];
          return {...meta,schema:z.toJSONSchema(params),enabled:settings.strategies[s.id]?.enabled ?? s.kind==="signal",
            params:settings.strategies[s.id]?.params ?? params.safeParse({}).data,
            recent_win_rate:samples.length?samples.filter(Boolean).length/samples.length:null};
        });
        return {items:result};
      }
      const usage=await budget.status(settings.budget);
      return {items:Object.entries(settings.definitions).filter(([id])=>!item||id===item).map(([id,cfg])=>{
        const result=journal.findLast(e=>e.stage==="model_provider" && healthRow.safeParse(e.detail).data?.provider===id);
        const health=healthRow.safeParse(result?.detail).data;
        const spent=usage.spent[id] ?? 0;
        return {id,enabled:settings.providers[id]===true,model:cfg.model,capabilities:cfg.capabilities,
          health:health?{ok:health.ok,latencyMs:health.latencyMs,last_checked_at:result?.at}:null,
          budget_used_usd:spent,budget_remaining_usd:Math.max(0,Math.min(usage.remaining,
            (settings.budget.perProvider[id] ?? Infinity)-spent))};
      })};
    },
    async mutate<T extends Change>(name:T,raw:unknown,actor:string) {
      const change=changes[name];
      const data=change.schema.parse(raw);
      // The paired schema is parsed before constructing its action.
      const make=change.action as (v:typeof data)=>unknown;
      const command=phase3Command.parse(make(data));
      const submitted=await inbox.submit(data.request_id ?? randomUUID(),actor,JSON.stringify(command),
        async()=>({type:"phase3",command}));
      const journal=await events();
      const result=journal.findLast(row=>row.stage==="control"&&commandSchema.parse(row.detail).id===submitted.id);
      return {request_id:submitted.id,actor,state:result?result.status==="ok"?"applied":"rejected":"queued",
        gaps:result?.gaps ?? []};
    },
  };
}
const healthRow=z.object({provider:z.string(),ok:z.boolean(),latencyMs:z.number()});
