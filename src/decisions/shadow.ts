import { randomUUID } from "node:crypto";
import { paperEntry, paperProceeds, type PaperCosts } from "../domain/paper-costs.js";
import type { Merged } from "../cache/merge.js";
import { targetKey } from "../cache/merge.js";
import type { Audit } from "../logging/logger.js";
import { elapsed, log, startTimer } from "../logging/operational.js";
import type { DecisionProvider, DecisionRequest } from "./contract.js";
import { validateDecision } from "./contract.js";
import { ProviderError } from "../providers/types.js";

type Outcome="filled"|"skipped"|"unavailable";
type Policy={horizonMs:number;labelWindowMs:number;notionalCents:number;costs:PaperCosts};
type Sample={id:string; observedAt:number; decidedAfter:number; dueAt:number; entryPrice:number; identity:Merged["identity"]};

/** One bounded worker. An observation is never awaited by the candidate loop. */
export class DecisionShadow {
  private readonly cohort=new Map<string,Sample>();
  private readonly jobs:Array<()=>Promise<void>>=[];
  private active?:Promise<void>;
  private unhealthyUntil=0;

  constructor(private readonly provider:DecisionProvider,private readonly audit:Audit,
    private readonly policy:Policy, private readonly signal:AbortSignal,
    private readonly reserve:()=>Promise<boolean>,private readonly clock=Date.now) {}

  observe(snapshot:Merged, outcome:Outcome) {
    if (this.signal.aborted) return;
    const {identity,quote,feed_entry:feed}=snapshot;
    const now=this.clock();
    const key=targetKey(identity);
    const existing=this.cohort.get(key);
    if (existing) {
      if (quote && quote.fetched_at>=existing.dueAt && quote.fetched_at<=now &&
          quote.fetched_at<=existing.dueAt+this.policy.labelWindowMs) {
        const proceeds=paperProceeds(this.policy.notionalCents,existing.entryPrice,quote.value,this.policy.costs);
        if (!Number.isSafeInteger(proceeds)) return;
        if (this.enqueue(()=>this.audit({identity:existing.identity,stage:"decision_shadow_outcome",status:"ok",gaps:[],
          detail:{version:1,decision_id:existing.id,label_at:quote.fetched_at,net_cents:proceeds-this.policy.notionalCents}}))) {
          this.cohort.delete(key);
        }
        return;
      }
      if (now<=existing.dueAt+this.policy.labelWindowMs) return;
      this.cohort.delete(key);
    }
    if (!quote || !feed || quote.fetched_at>now || quote.value<=0 || now<this.unhealthyUntil) return;
    if (this.cohort.size>=512) {
      for (const [expiredKey,sample] of this.cohort) {
        if (now>sample.dueAt+this.policy.labelWindowMs) this.cohort.delete(expiredKey);
      }
      if (this.cohort.size>=512) return;
    }
    const entryPrice=paperEntry(this.policy.notionalCents,quote.value,snapshot.expected_slippage_bps,this.policy.costs);
    if (entryPrice===null) return;
    const sample={id:randomUUID(), observedAt:quote.fetched_at,decidedAfter:now,dueAt:now+this.policy.horizonMs,entryPrice,identity};
    const facts={liquidity_usd:feed.liquidity_usd,volume_1h_usd:feed.vol_1h_usd,pool_age_sec:feed.age_sec};
    const request:DecisionRequest={
      facts,
      input:JSON.stringify({...facts,security_assessment:snapshot.assessment,
        source_disagreement:snapshot.sources_disagree,slippage_bps:snapshot.expected_slippage_bps,
        horizon_ms:this.policy.horizonMs,notional_cents:this.policy.notionalCents,costs:this.policy.costs}),
      questions:[{id:"positive_net_return",type:"predicate",
        instructions:"Will the position have positive modeled round-trip P&L at the specified horizon? Use the supplied numerical snapshot and cost assumptions."}],
    };
    if (this.enqueue(()=>this.evaluate(sample,request,outcome))) this.cohort.set(key,sample);
  }

  private async evaluate(sample:Sample,request:DecisionRequest,outcome:Outcome) {
    const started=startTimer();
    let reason="budget_exhausted";
    let result;
    try {
      if (this.clock()>=sample.dueAt) reason="missed_decision_deadline";
      else if (this.signal.aborted) reason="cancelled";
      else if (this.clock()<this.unhealthyUntil) reason="provider_cooldown";
      else if (await this.reserve()) {
        result=validateDecision(request,await this.provider.evaluate(request,this.signal));
        reason=this.clock()<sample.dueAt?"evaluated":"missed_decision_deadline";
      }
    } catch (error) {
      reason=error instanceof ProviderError?error.kind:"decision_unavailable";
      if (reason!=="cancelled") {
        this.unhealthyUntil=this.clock()+Math.max(60_000,error instanceof ProviderError?error.retryAfterMs ?? 0:0);
      }
    }
    const ok=reason==="evaluated";
    const duration_ms=elapsed(started);
    await this.audit({identity:sample.identity,stage:"decision_shadow",status:ok?"ok":"skipped",gaps:ok?[]:[reason],
      detail:{version:1,decision_id:sample.id,input_snapshot_at:sample.observedAt,decided_after:sample.decidedAfter,
        evaluated_at:this.clock(),due_at:sample.dueAt,baseline:outcome,provider:this.provider.id,model:result?.model,
        result:ok?result?.answers[0]:undefined,cost_usd:result?.costUsd,duration_ms,policy:this.policy,reason}});
    log(ok?"debug":"warn","decision.shadow",{run_id:sample.identity.run_id,chain:sample.identity.chain,provider:this.provider.id,duration_ms,reason});
  }

  private enqueue(job:()=>Promise<void>) {
    if (this.jobs.length>=32) {
      log("warn","decision.shadow_dropped",{reason:"queue_full",count:this.jobs.length});
      return false;
    }
    this.jobs.push(job);
    if (!this.active) {
      this.active=this.drain().finally(()=>{this.active=undefined;});
    }
    return true;
  }

  private async drain() {
    while (this.jobs.length) {
      const job=this.jobs.shift()!;
      try { await job(); }
      catch { log("error","decision.shadow_failed",{reason:"journal_unavailable"}); }
    }
  }

  async settled() { await this.active; }
}
