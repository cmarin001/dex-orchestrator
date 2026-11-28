import { log } from "../logging/operational.js";
import type { ProviderPolicy } from "../../schemas/provider-config.js";
import type { BudgetConfig } from "../../schemas/budget.js";
import type { Budget } from "./budget.js";
import type { CompletionRequest, CompletionResponse, ReasoningProvider } from "./types.js";
import { AllProvidersDownError, BudgetExhaustedError, ProviderError } from "./types.js";

type Observation={provider:string;ok:boolean;latencyMs:number;stage:string;
  runId?:string;configurationVersion?:string;model?:string;failure?:string;
  inputTokens?:number;outputTokens?:number;cachedInputTokens?:number;estimatedCostUsd?:number;costUsd?:number};

export class Router {
  private readonly unreliable=new Map<string,number>();
  private round=0;
  private inFlight=0;
  constructor(readonly providers:Map<string,ReasoningProvider>,readonly budget:Pick<Budget,"reserve">, private now=Date.now, private observe?: (value:Observation)=>Promise<void>) {}
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
      let streamed=false;
      let metadata:Pick<Observation,"runId"|"configurationVersion"|"model">={model:provider.modelId};
      try {
        return await use(async req=>{
          if (req.signal?.aborted) throw new ProviderError("cancelled");
          const selected={...req,model:tiers[provider.id]?.[stage] ?? req.model,
            ...(req.onTextDelta ? {onTextDelta:(value:string)=>{streamed=true; req.onTextDelta!(value);}} : {})};
          metadata={runId:req.runId,configurationVersion:req.configurationVersion,model:selected.model ?? provider.modelId};
          provider.preflight?.(selected);
          if (this.inFlight>=8) throw new ProviderError("concurrency_limit");
          this.inFlight++;
          try {
            const estimatedCostUsd=provider.estimateCost(selected);
            const reserve=await this.budget.reserve(provider.id,estimatedCostUsd,budgetConfig);
            if (!reserve) throw new BudgetExhaustedError();
            const res=await provider.complete(selected);
            let metrics:Pick<Observation,"inputTokens"|"outputTokens"|"cachedInputTokens"|"costUsd">={};
            if (res.usage) {
              const {input,output,cached}=res.usage;
              const c=provider.capabilities;
              const costUsd=((input-Math.min(cached,input)*c.cacheDiscount)*c.costPerMTokIn+output*c.costPerMTokOut)/1e6;
              await reserve(costUsd);
              metrics={inputTokens:input,outputTokens:output,cachedInputTokens:cached,costUsd};
            }
            if (this.observe) {
              await this.observe({provider:provider.id,stage,...metadata,...await provider.health(),estimatedCostUsd,...metrics});
            }
            return res;
          } finally { this.inFlight--; }
        });
      } catch (error) {
        if (streamed) throw error;
        if (error instanceof BudgetExhaustedError) { budgetBlocked++; continue; }
        if (!(error instanceof ProviderError) || error.kind==="cancelled" || error.kind==="concurrency_limit") throw error;
        const kind=error.kind;
        const incompatible=kind==="unsupported_capability" || kind==="context_limit";
        const category=kind==="authentication" || kind==="configuration" ? "error" : kind;
        if (!incompatible && !policy.fallback_on.some(item=>item===category)) throw error;
        if (!incompatible && kind!=="schema_mismatch") {
          const cooldown=Math.max(policy.healthCheckIntervalSec*1000,error.retryAfterMs ?? 0);
          this.unreliable.set(provider.id,this.now()+cooldown);
        }
        if (this.observe) await this.observe({provider:provider.id,stage,...metadata,ok:false,latencyMs:(await provider.health()).latencyMs,failure:kind});
        log("warn","provider.fallback",{stage,provider:provider.id,reason:error.kind});
      }
    }
    if (available.length>0 && budgetBlocked===available.length) throw new BudgetExhaustedError();
    throw new AllProvidersDownError();
  }
}
