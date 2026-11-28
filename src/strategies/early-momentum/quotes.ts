import type { EarlyMomentumEvidence, EarlyMomentumParams, MomentumQuote } from "../../../schemas/early-momentum.js";

export function quoteCosts(q: MomentumQuote) {
  return q.tradingFeeCents + q.networkFeeCents + q.transferFeeCents + q.slippageCents + q.impactCents;
}

export function liquidationValue(q: MomentumQuote) {
  return q.grossCents - quoteCosts(q);
}

export function freshQuote(q: MomentumQuote, at: number, maxAge: number) {
  return q.observedAt <= at && at - q.observedAt <= maxAge && q.expiresAt > at && liquidationValue(q) >= 0;
}

export function qualifyingOffers(evidence: EarlyMomentumEvidence, config: EarlyMomentumParams, at: number, observedAt = at, referencePrice?:number) {
  return evidence.offers.filter(({ buy, sell }) =>
    buy.tokenAmount === sell.tokenAmount &&
    [buy, sell].every(q => q.observedAt <= observedAt && freshQuote(q, at, config.maxEvidenceAgeMs) &&
      (referencePrice===undefined || Math.abs(q.grossCents/100/q.tokenAmount/referencePrice-1)<=config.maxPriceExtension) &&
      10_000 * quoteCosts(q) <= config.maxCostBps * q.grossCents &&
      10_000 * q.impactCents <= config.maxImpactBps * q.grossCents));
}
