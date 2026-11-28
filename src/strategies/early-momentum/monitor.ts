import { z } from "zod";
import { tradeKey } from "../../../schemas/common.js";
import type { Target } from "../../../schemas/common.js";
import { earlyMomentumId } from "../../../schemas/early-momentum.js";
import type { EarlyMomentumEvidence, MomentumQuote } from "../../../schemas/early-momentum.js";
import type { ExitPolicy } from "../../../schemas/exit-policy.js";
import { reconKey, targetKey } from "../../cache/merge.js";
import type { JournalEvent } from "../../logging/types.js";
import type { Audit } from "../../logging/logger.js";
import type { Position } from "../../state/positions.js";
import type { StrategyEvidence } from "../evidence.js";
import { freshQuote, liquidationValue, quoteCosts } from "./quotes.js";

export const managedPolicy = (policy: ExitPolicy | undefined) => policy?.mode==="stop_loss" ? policy.early_momentum : undefined;
const exitReason = z.enum(["initial_stop","fixed_profit","trailing_stop","time_limit","liquidity_deterioration","momentum_deterioration","manual_or_emergency"]);
const monitorState = z.strictObject({
  state:z.enum(["POSITION_OPEN","MOMENTUM_ACTIVE","EXIT_PENDING"]),
  highestPrice:z.number().positive(),
  highestCents:z.number().int().nonnegative(),
  lowestCents:z.number().int().nonnegative(),
  trailingCents:z.number().int().nonnegative().optional(),
  lastQuoteAt:z.number().int(),
  lastProceedsCents:z.number().int().nonnegative(),
  pending:exitReason.optional(),
});
export type MonitorState = z.infer<typeof monitorState>;
type Evidence = {fetched_at:number;early_momentum?:EarlyMomentumEvidence} | undefined;

export function initialMonitor(position: Position): MonitorState {
  const rules=managedPolicy(position.exit_policy)!;
  const proceeds=rules.initialProceedsCents;
  return {state:"POSITION_OPEN",highestPrice:rules.initialMarketPrice,highestCents:Math.max(position.cost_cents,proceeds),
    lowestCents:Math.min(position.cost_cents,proceeds),lastQuoteAt:-1,lastProceedsCents:proceeds};
}

export function advanceMomentum(position:Position, previous:MonitorState, evidence:Evidence, at:number, forced:boolean, allowDiscretionary=true) {
  const policy=position.exit_policy!;
  const rules=managedPolicy(policy)!;
  const fresh=evidence && evidence.fetched_at<=at && at-evidence.fetched_at<=rules.maxEvidenceAgeMs
    ? evidence.early_momentum : undefined;
  const quoted=fresh?.liquidation;
  const quote=quoted && quoted.tokenAmount===rules.tokenAmount && quoted.observedAt>=policy.entry_at &&
    quoted.observedAt>previous.lastQuoteAt && quoted.observedAt<=evidence!.fetched_at &&
    freshQuote(quoted,at,rules.maxEvidenceAgeMs) ? quoted : undefined;
  const value=quote ? liquidationValue(quote) : undefined;
  const next={...previous};
  if (quote && value!==undefined && quote.observedAt>previous.lastQuoteAt) {
    next.lastQuoteAt=quote.observedAt;
    next.lastProceedsCents=value;
    next.highestCents=Math.max(next.highestCents,value);
    next.lowestCents=Math.min(next.lowestCents,value);
    next.highestPrice=Math.max(next.highestPrice,quote.grossCents/100/quote.tokenAmount);
    if (rules.style==="trailing" && next.highestCents*10_000>=position.cost_cents*(10_000+rules.trailActivationBps)) {
      next.trailingCents=Math.max(next.trailingCents ?? 0,Math.floor(next.highestCents*(10_000-rules.trailDistanceBps)/10_000));
      next.state="MOMENTUM_ACTIVE";
    }
  }
  const closed=fresh?.candles.filter(c=>c.openAt+60_000<=evidence!.fetched_at && c.openAt>=policy.entry_at)
    .sort((a,b)=>a.openAt-b.openAt).slice(-rules.momentumBearCandles) ?? [];
  const deteriorating=closed.length===rules.momentumBearCandles &&
    at-closed.at(-1)!.openAt-60_000<=60_000+rules.maxEvidenceAgeMs &&
    closed.every((c,i)=>c.close<c.open && (i===0 || c.openAt-closed[i-1]!.openAt===60_000 && c.close<closed[i-1]!.close));
  const initialStop=policy.mode==="stop_loss" ? policy.stop_loss_bps : 0;
  if (forced) next.pending="manual_or_emergency";
  else if (!next.pending) {
    if (value!==undefined && value*10_000<=position.cost_cents*(10_000-initialStop)) next.pending="initial_stop";
    else if (next.trailingCents!==undefined && value!==undefined && value<=next.trailingCents) next.pending="trailing_stop";
    else if (fresh && fresh.liquidityUsd<=rules.entryLiquidityUsd*(1-rules.liquidityDrop)) next.pending="liquidity_deterioration";
    else if (at>=policy.entry_at+policy.max_hold_sec*1000) next.pending="time_limit";
    else if (allowDiscretionary && deteriorating) next.pending="momentum_deterioration";
    else if (rules.style==="fixed" && value!==undefined &&
      value*10_000>=position.cost_cents*(10_000+rules.takeProfitBps)) next.pending="fixed_profit";
  }
  if (next.pending) next.state="EXIT_PENDING";
  return {state:next,quote};
}

export class MomentumPositions {
  private readonly states=new Map<string,MonitorState>();
  private readonly cooldowns=new Map<string,number>();

  constructor(journal:readonly JournalEvent[], readonly evidence:StrategyEvidence) {
    for (const row of journal) {
      if (row.identity && row.stage==="early_momentum_monitor") {
        this.states.set(tradeKey(row.identity),monitorState.parse(row.detail));
      }
      if (row.status==="paper_close" && row.position && row.close && managedPolicy(row.position.exit_policy)) {
        this.closed(row.position,row.close.exit_at);
      }
    }
  }

  cooling(target:Target, at:number) {
    for (const [key,until] of this.cooldowns) if (until<=at) this.cooldowns.delete(key);
    return (this.cooldowns.get(reconKey(target)) ?? 0)>at;
  }

  async check(position:Position, at:number, forced:boolean,audit:Audit,allowDiscretionary=true) {
    const previous=this.states.get(tradeKey(position)) ?? initialMonitor(position);
    const input=this.evidence.get(targetKey(position),at);
    const result=advanceMomentum(position,previous,input,at,forced,allowDiscretionary);
    if (JSON.stringify(result.state)!==JSON.stringify(previous)) {
      const gaps=result.state.pending && !result.quote ? ["executable_sell_quote_unavailable"] : [];
      const {run_id,chain,token,pair}=position;
      await audit({identity:{run_id,chain,token,pair}, stage:"early_momentum_monitor", status:gaps.length?"skipped":"ok", gaps, detail:result.state});
      this.states.set(tradeKey(position),result.state);
    }
    return result;
  }

  exitDetail(position:Position,state:MonitorState,quote:MomentumQuote,at:number) {
    return {strategyId:earlyMomentumId,version:1,state:"EXIT_CONFIRMED",nextState:"COOLDOWN",
      reason:state.pending,highestPrice:state.highestPrice,trailingCents:state.trailingCents,
      proceedsCents:liquidationValue(quote), realizedNetCents:liquidationValue(quote)-position.cost_cents,
      mfeCents:state.highestCents-position.cost_cents,maeCents:state.lowestCents-position.cost_cents,
      entryCostsCents:managedPolicy(position.exit_policy)!.entryCostsCents, exitCostsCents:quoteCosts(quote),
      transactionCostsCents:managedPolicy(position.exit_policy)!.entryCostsCents+quoteCosts(quote),quote,holdingMs:at-position.exit_policy!.entry_at,
      cooldownUntil:at+managedPolicy(position.exit_policy)!.cooldownSec*1000};
  }

  closed(position:Position,at:number) {
    this.states.delete(tradeKey(position));
    const key=reconKey(position);
    const until=at+managedPolicy(position.exit_policy)!.cooldownSec*1000;
    this.cooldowns.set(key,Math.max(until,this.cooldowns.get(key) ?? 0));
  }
}
