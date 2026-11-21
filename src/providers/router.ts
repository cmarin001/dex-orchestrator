import { log } from "../logging/operational.js";
import type { ProviderPolicy } from "../../schemas/provider-config.js";
import type { BudgetConfig } from "../../schemas/budget.js";
import type { Budget } from "./budget.js";
import type { CompletionRequest, CompletionResponse, ModelProvider } from "./types.js";
import { AllProvidersDownError, BudgetExhaustedError, ProviderError } from "./types.js";

export class Router {
  private readonly unreliable=new Map<string,number>();
  private round=0;
  constructor(readonly providers:Map<string,ModelProvider>,readonly budget:Budget, private now=Date.now, private observe?: (value:{provider:string;ok:boolean;latencyMs:number})=>Promise<void>) {}
  async run<T>(policy:ProviderPolicy, budgetConfig:BudgetConfig, enabled:Record<string,boolean>,
    tiers:Record<string,Record<string,string>>, stage:string, use:(ask:(req:CompletionRequest)=>Promise<CompletionResponse>)=>Promise<T>) {
    const available=policy.order.flatMap(id=>{
      const found=this.providers.get(id);
      return found && enabled[id] && (this.unreliable.get(id) ?? -Infinity) <= this.now() ? [found] : [];
    });
    if (policy.mode==="latency") {
      const metrics=await Promise.all(available.map(async p=>({p,latency:(await p.health()).latencyMs})));
      available.splice(0,available.length,...metrics.sort((a,b)=>a.latency-b.latency).map(x=>x.p));
    } else if (policy.mode==="quality") {
      available.sort((a,b)=>Number(b.capabilities.structuredOutputs)-Number(a.capabilities.structuredOutputs) ||
        b.capabilities.maxContextTokens-a.capabilities.maxContextTokens);
    } else if (policy.mode==="round_robin" && available.length) {
      available.push(...available.splice(0,this.round++%available.length));
    }
    let budgetBlocked=0;
    for (const provider of available) {
      try {
        return await use(async req=>{
          req.signal?.throwIfAborted();
          const selected={...req,model:tiers[provider.id]?.[stage] ?? req.model};
          const reserve=await this.budget.reserve(provider.id,provider.estimateCost(selected),budgetConfig);
          if (!reserve) throw new BudgetExhaustedError();
          const res=await provider.complete(selected);
          if (this.observe) await this.observe({provider:provider.id,...await provider.health()});
          if (res.usage) {
            const {input,output,cached}=res.usage;
            const c=provider.capabilities;
            await reserve(((input-Math.min(cached,input)*c.cacheDiscount)*c.costPerMTokIn+output*c.costPerMTokOut)/1e6);
          }
          return res;
        });
      } catch (error) {
        if (error instanceof BudgetExhaustedError) { budgetBlocked++; continue; }
        if (!(error instanceof ProviderError) || !policy.fallback_on.includes(error.kind)) throw error;
        if (error.kind!=="schema_mismatch") this.unreliable.set(provider.id,this.now()+policy.healthCheckIntervalSec*1000);
        if (this.observe) await this.observe({provider:provider.id,ok:false,latencyMs:(await provider.health()).latencyMs});
        log("warn","provider.fallback",{stage,provider:provider.id,reason:error.kind});
      }
    }
    if (available.length>0 && budgetBlocked===available.length) throw new BudgetExhaustedError();
    throw new AllProvidersDownError();
  }
}
