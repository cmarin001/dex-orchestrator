import type { EarlyMomentumEvidence, EarlyMomentumParams, MomentumQuote } from "../../../schemas/early-momentum.js";
import type { ExitPolicy } from "../../../schemas/exit-policy.js";
import { liquidationValue, qualifyingOffers, quoteCosts } from "./quotes.js";

export function selectMomentumOffer(evidence:EarlyMomentumEvidence, config:EarlyMomentumParams,
  at:number, observedAt:number, price:number, budgetCents:number, maxSlippageBps:number) {
  if (observedAt>at || at-observedAt>config.maxEvidenceAgeMs) return undefined;
  return qualifyingOffers(evidence,config,at,observedAt,price)
    .filter(({buy,sell}) => buy.grossCents+quoteCosts(buy)<=budgetCents && [buy,sell].every(q=>
      10_000*(q.slippageCents+q.impactCents)<=maxSlippageBps*q.grossCents))
    .sort((a,b)=>b.buy.grossCents+quoteCosts(b.buy)-a.buy.grossCents-quoteCosts(a.buy) ||
      liquidationValue(b.sell)-liquidationValue(a.sell))[0];
}

export function momentumExitPolicy(p:EarlyMomentumParams, offer:{buy:MomentumQuote;sell:MomentumQuote},
  price:number, liquidity:number, at:number):ExitPolicy {
  return {entry_price:price,entry_at:at,mode:"stop_loss",stop_loss_bps:p.initialStopBps,max_hold_sec:p.maxHoldSec,
    min_profit_bps_for_exit:25,timeout_ladder:[{at_sec:0,target_profit_bps:p.style==="fixed"?p.takeProfitBps:p.trailActivationBps}],
    early_momentum:{version:p.version,tokenAmount:offer.buy.tokenAmount,initialProceedsCents:liquidationValue(offer.sell),
      entryCostsCents:quoteCosts(offer.buy),initialMarketPrice:offer.sell.grossCents/100/offer.sell.tokenAmount,entryLiquidityUsd:liquidity,
      maxEvidenceAgeMs:p.maxEvidenceAgeMs,style:p.style,takeProfitBps:p.takeProfitBps,trailActivationBps:p.trailActivationBps,
      trailDistanceBps:p.trailDistanceBps,liquidityDrop:p.liquidityDrop,momentumBearCandles:p.momentumBearCandles,cooldownSec:p.cooldownSec}};
}
