import type { Audit } from "../logging/logger.js";
import { elapsed, log, startTimer } from "../logging/operational.js";
import type { Merged } from "../cache/merge.js";
import type { DecisionProvider } from "./contract.js";
import { validateDecision } from "./contract.js";
import { ProviderError } from "../providers/types.js";

export function entryDecisionGate(provider:DecisionProvider,audit:Audit,liquidityUsd:number) {
  return async (snapshot:Merged,signal?:AbortSignal) => {
    const started=startTimer();
    const question={id:"entry_liquidity",type:"predicate",instructions:"Is liquidity at or above the configured threshold?"} as const;
    const input={liquidity:snapshot.feed_entry?.liquidity_usd ?? 0,minimum:liquidityUsd};
    const request={input:JSON.stringify(input),facts:input,questions:[question]};
    let allowed=false;
    let reason="decision_unavailable";
    let model:string|undefined;
    let result:unknown;
    try {
      const decision=validateDecision(request,await provider.evaluate(request,signal));
      model=decision.model;
      const answer=decision.answers[0]!;
      result=answer;
      allowed=!signal?.aborted && answer.type==="predicate" && answer.probability===1;
      reason=allowed?"accepted":answer.type==="abstention"?"abstained":"threshold_unmet";
    } catch (error) {
      if (error instanceof ProviderError) reason=error.kind;
    }
    const duration_ms=elapsed(started);
    const identity=snapshot.identity;
    await audit({identity,stage:"decision_gate",status:allowed?"ok":"skipped",gaps:allowed?[]:[reason],
      detail:{version:1,policy_version:`liquidity-v1:${liquidityUsd}`,decision_id:`${identity.run_id}:${identity.token}:entry-liquidity`,
        snapshot_at:snapshot.quote?.fetched_at,provider:provider.id,model,result,duration_ms,reason}});
    log("debug","decision.entry_gate",{run_id:identity.run_id,chain:identity.chain,provider:provider.id,duration_ms,reason});
    return allowed;
  };
}
