import { randomUUID } from "node:crypto";
import type { Handoff } from "../../schemas/common.js";
import { earlyMomentumId } from "../../schemas/early-momentum.js";
import type { Audit } from "../logging/logger.js";
import { elapsed, startTimer } from "../logging/operational.js";
import { ProviderError } from "../providers/types.js";
import { validateDecision } from "./contract.js";
import type { DecisionProvider } from "./contract.js";

type EntryReview = {
  identity: Handoff;
  deadline: number;
  facts: {
    pool_age_sec: number;
    liquidity_usd: number;
    volume_1h_usd: number;
    buy_ratio: number;
    proposed_cost_cents: number;
    quoted_liquidation_cents: number;
  };
};

export type PaperEntryReview = (entry: EntryReview, signal?: AbortSignal) => Promise<string | undefined>;

export function paperEntryReview(provider:DecisionProvider,audit:Audit,options:{
  reserve:()=>Promise<boolean>; approvalThreshold:number; timeoutMs:number; now?:()=>number;
}):PaperEntryReview {
  let active=false;
  const now=options.now ?? Date.now;
  return async (entry,signal)=>{
    const started=startTimer();
    const decisionId=randomUUID();
    const request={input:JSON.stringify(entry.facts),facts:entry.facts,questions:[{
      id:"paper_entry",type:"choice" as const,choices:["approve","skip","abstain"],
      instructions:"Review this already qualified paper entry. Choose approve only if the numerical evidence supports continuation given liquidity, demand, and quoted round-trip costs. Choose skip when the evidence argues against continuation, or abstain when uncertain.",
    }]};
    let reason="decision_unavailable";
    let model:string|undefined;
    let approval:number|undefined;
    let choice:string|undefined;
    if (signal?.aborted) reason="cancelled";
    else if (entry.deadline<=now()) reason="evidence_expired";
    else if (active) reason="concurrency_limit";
    else {
      active=true;
      let timeout:AbortSignal|undefined;
      try {
        if (!await options.reserve()) reason="budget_exhausted";
        else {
          const remaining=Math.min(options.timeoutMs,entry.deadline-now());
          if (remaining<=0) reason="evidence_expired";
          else if (signal?.aborted) reason="cancelled";
          else {
            timeout=AbortSignal.timeout(remaining);
            const bounded=signal ? AbortSignal.any([timeout,signal]) : timeout;
            const result=validateDecision(request,await provider.evaluate(request,bounded));
            model=result.model;
            const answer=result.answers[0]!;
            if (answer.type==="choice") {
              choice=answer.choice;
              approval=answer.distribution.find(item=>item.label==="approve")?.probability;
            }
            if (signal?.aborted) reason="cancelled";
            else if (entry.deadline<=now()) reason="evidence_expired";
            else if (timeout.aborted) reason="timeout";
            else if (choice==="skip") reason="rejected";
            else if (choice!=="approve") reason="abstained";
            else reason=approval!==undefined && approval>=options.approvalThreshold ? "approved" : "below_threshold";
          }
        }
      } catch (error) {
        if (signal?.aborted) reason="cancelled";
        else if (entry.deadline<=now()) reason="evidence_expired";
        else if (timeout?.aborted) reason="timeout";
        else if (error instanceof ProviderError) reason=error.kind;
      } finally { active=false; }
    }
    await audit({identity:entry.identity,stage:"paper_entry_review",status:reason==="approved"?"ok":"skipped",
      gaps:reason==="approved"?[]:[reason],detail:{version:1,decision_id:decisionId,strategy_id:earlyMomentumId,
        provider:provider.id,model,choice,approval,approval_threshold:options.approvalThreshold,reason,
        deadline:entry.deadline,duration_ms:elapsed(started),facts:entry.facts}});
    return reason==="approved" && !signal?.aborted && now()<entry.deadline ? decisionId : undefined;
  };
}
