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

type ReviewOptions={reserve:()=>Promise<boolean>; approvalThreshold:number; timeoutMs:number; now?:()=>number};
export type TradeReviewInput={identity:Handoff; deadline:number; facts:Record<string,number>};
export type TradeReview=(input:TradeReviewInput,signal?:AbortSignal)=>Promise<string|undefined>;

export function paperEntryReview(provider:DecisionProvider,audit:Audit,options:ReviewOptions):PaperEntryReview {
  return tradeReview(provider,audit,options,"paper_entry");
}

export function tradeReview(provider:DecisionProvider,audit:Audit,options:ReviewOptions,
  action:"paper_entry"|"buy"|"sell"):TradeReview {
  const positive=action==="paper_entry"?"approve":action;
  const negative=action==="sell"?"hold":"skip";
  let active=false;
  const now=options.now ?? Date.now;
  return async (entry,signal)=>{
    const started=startTimer();
    const decisionId=randomUUID();
    const request={input:JSON.stringify(entry.facts),facts:entry.facts,questions:[{
      id:action,type:"choice" as const,choices:[positive,negative,"abstain"],
      instructions:action==="sell"
        ?"Assess the numerical evidence for reducing exposure in this existing position. Choose sell when the evidence supports closing now, hold when it supports retaining the position, or abstain when uncertain."
        :`Review this already qualified entry. Choose ${positive} when the numerical evidence supports entry given demand and quoted or estimated economics, skip when it argues against entry, or abstain when uncertain.`,
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
              approval=answer.distribution.find(item=>item.label===positive)?.probability;
            }
            if (signal?.aborted) reason="cancelled";
            else if (entry.deadline<=now()) reason="evidence_expired";
            else if (timeout.aborted) reason="timeout";
            else if (choice===negative) reason="rejected";
            else if (choice!==positive) reason="abstained";
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
    await audit({identity:entry.identity,stage:action==="paper_entry"?"paper_entry_review":"jev_trade_review",status:reason==="approved"?"ok":"skipped",
      gaps:reason==="approved"?[]:[reason],detail:{version:1,decision_id:decisionId,action,...(action==="paper_entry"?{strategy_id:earlyMomentumId}:{}),
        provider:provider.id,model,choice,approval,approval_threshold:options.approvalThreshold,reason,
        deadline:entry.deadline,duration_ms:elapsed(started),facts:entry.facts}});
    return reason==="approved" && !signal?.aborted && now()<entry.deadline ? decisionId : undefined;
  };
}
