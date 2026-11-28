import { earlyMomentumId, earlyMomentumParams, earlyMomentumVersion, manipulationChecks } from "../../../schemas/early-momentum.js";
import type { EarlyMomentumParams } from "../../../schemas/early-momentum.js";
import type { Signal } from "../../../schemas/signal.js";
import { mean, rsi } from "../strategy.js";
import type { Strategy, StrategyContext } from "../strategy.js";
import { qualifyingOffers } from "../early-momentum/quotes.js";

const minute = 60_000;
const clamp = (value: number) => Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
const ema = (values: number[], length: number) => values.reduce((state, value) => state + (value-state)*2/(length+1), values[0]!);

export const candidateStates = ["DISCOVERED","QUALIFIED","WATCHING","ACCUMULATING","REVERSAL_CONFIRMED","ENTRY_ELIGIBLE","REJECTED"] as const;
type CandidateState = typeof candidateStates[number];

function classify(score: number) {
  return score < 40 ? "REJECT" : score < 60 ? "OBSERVE" : score < 80 ? "WATCH" : score < 90 ? "ENTRY_ELIGIBLE" : "HIGH_PRIORITY";
}

export function assessEarlyMomentum(ctx: StrategyContext, p: EarlyMomentumParams) {
  const { current, earlyMomentum } = ctx;
  const at = ctx.asOf ?? current.at;
  const evidence = earlyMomentum?.data;
  const availableChecks = Object.fromEntries(manipulationChecks.map(check => [check,evidence?.checks?.[check] ?? "unknown"]));
  const states: CandidateState[] = ["DISCOVERED"];
  const factors = {reversal:0,volume:0,liquidity:0,buyers:0,holders:0,momentum:0,social:0};
  let features: Record<string,unknown> = {};
  const finish = (reason: string) => {
    const contributions = Object.fromEntries(Object.entries(factors).map(([key,value]) => {
      const name = key as keyof typeof factors;
      return [name, value*p.weights[name]*100];
    }));
    const score = Math.round(Object.values(contributions).reduce((sum, value) => sum+value,0)*100)/100;
    return {state:states.at(-1)!, states, reason, score, classification:classify(score), contributions, features,
      checks:availableChecks, marketAt:current.at, evidenceAt:earlyMomentum?.observedAt};
  };
  const reject = (reason: string) => { states.push("REJECTED"); return finish(reason); };
  if (!evidence || earlyMomentum.observedAt > at || at-earlyMomentum.observedAt > p.maxEvidenceAgeMs ||
      current.at > at || at-current.at > p.maxEvidenceAgeMs) return finish("missing_or_stale_evidence");
  const age = (at-evidence.poolCreatedAt)/1000;
  const tokenAge = evidence.tokenCreatedAt === undefined ? null : (at-evidence.tokenCreatedAt)/1000;
  features = {poolAgeSec:age, tokenAgeSec:tokenAge, price:current.price, liquidityUsd:evidence.liquidityUsd,
    marketCapUsd:current.marketCap ?? null, volumeToMarketCap:current.marketCap ? current.volume/current.marketCap : null};
  if (age < p.minPoolAgeSec || age > p.maxPoolAgeSec || tokenAge !== null &&
      (evidence.tokenCreatedAt! > evidence.poolCreatedAt || tokenAge > p.maxPoolAgeSec)) return reject("pool_or_token_age");
  if (Math.min(current.liquidity,evidence.liquidityUsd) < p.minLiquidityUsd || current.volume < p.minVolumeHourUsd) return reject("discovery_floor");
  if (Object.values(availableChecks).includes("flagged")) return reject("manipulation_or_token_risk");
  if (current.top10 == null) return finish("holder_concentration_unavailable");
  if (current.top10 > p.maxTop10Pct) return reject("holder_concentration");
  states.push("QUALIFIED","WATCHING");

  const candles = evidence.candles.filter(c => c.openAt >= evidence.poolCreatedAt &&
    c.openAt + minute <= earlyMomentum.observedAt).sort((a,b) => a.openAt-b.openAt).slice(-p.lookbackCandles);
  const latest = candles.at(-1);
  const needed = Math.max(p.volumeWindow * (1+p.volumeBaselineWindows), 2*p.swingRadius+5);
  if (!latest || candles.length < needed || at-latest.openAt-minute > minute+p.maxEvidenceAgeMs ||
      candles.some((c,i) => i>0 && c.openAt-candles[i-1]!.openAt!==minute)) return finish("closed_candle_history_unavailable");
  const past = candles.slice(0,-p.volumeWindow);
  const baseline = mean(past.slice(-p.volumeWindow*p.volumeBaselineWindows).map(c=>c.volumeUsd));
  const recentVolume=mean(candles.slice(-p.volumeWindow).map(c=>c.volumeUsd));
  if (!Number.isFinite(baseline) || !Number.isFinite(recentVolume)) return reject("invalid_volume_baseline");
  const acceleration = baseline > 0 ? recentVolume/baseline : 0;
  if (!Number.isFinite(acceleration)) return reject("invalid_volume_baseline");
  const liquidityChange = evidence.priorLiquidityUsd && evidence.priorLiquidityAt !== undefined &&
    earlyMomentum.observedAt-evidence.priorLiquidityAt >= minute && earlyMomentum.observedAt-evidence.priorLiquidityAt <= 10*minute
    ? evidence.liquidityUsd/evidence.priorLiquidityUsd-1 : null;
  const activity = evidence.activity;
  const trades = activity ? activity.buys+activity.sells : 0;
  const buyRatio = activity && trades ? activity.buys/trades : null;

  const lows: number[] = [], highs: number[] = [];
  for (let i=p.swingRadius; i<candles.length-p.swingRadius; i++) {
    const point=candles[i]!;
    const neighbors=candles.slice(i-p.swingRadius,i+p.swingRadius+1).filter(c=>c!==point);
    if (neighbors.every(c=>point.low<c.low)) lows.push(i);
    if (neighbors.every(c=>point.high>c.high)) highs.push(i);
  }
  const formation=lows.slice(-(p.higherLows+1));
  const trough=formation[0], finalLow=formation.at(-1);
  const anchor=highs.filter(i=>trough !== undefined && i<trough).sort((a,b)=>candles[b]!.high-candles[a]!.high || b-a)[0];
  const pullback=anchor===undefined || trough===undefined ? null : 1-candles[trough]!.low/candles[anchor]!.high;
  const support=finalLow===undefined ? null : candles[finalLow]!.low;
  const resistance=trough===undefined || finalLow===undefined || finalLow===trough ? null :
    Math.max(...candles.slice(trough+1,finalLow).map(c=>c.high));
  const closes=candles.map(c=>c.close);
  const momentum=closes.length >= 22 ? {rsi:rsi(closes.slice(-15)), ema9:ema(closes,9), ema21:ema(closes,21),
    crossedUp:ema(closes.slice(0,-1),9)<=ema(closes.slice(0,-1),21) && ema(closes,9)>ema(closes,21)} : null;
  const priorHolder=ctx.history.findLast(row=>row.at<=at-5*minute && row.at>=at-60*minute && (row.holders ?? 0)>0);
  const holderGrowth=priorHolder?.holders && current.holders != null ? current.holders/priorHolder.holders-1 : null;
  const uniqueBuyerGrowth=activity?.uniqueBuyers !== undefined && activity.priorUniqueBuyers ?
    activity.uniqueBuyers/activity.priorUniqueBuyers-1 : null;
  const fallingStructure=lows.length>=2 && highs.length>=2 &&
    candles[lows.at(-1)!]!.low<candles[lows.at(-2)!]!.low && candles[highs.at(-1)!]!.high<candles[highs.at(-2)!]!.high;
  Object.assign(features,{pullback, support, resistance, acceleration, liquidityChange, buyRatio, uniqueBuyerGrowth,
    holderGrowth, fallingStructure, momentum, latestClosedAt:latest.openAt+minute});
  if (liquidityChange === null || buyRatio === null || trades < p.minTrades5m) return finish("demand_or_liquidity_baseline_unavailable");
  if (liquidityChange < -p.maxLiquidityDecline) return reject("liquidity_deteriorating");
  if (activity?.uniqueBuyers !== undefined && activity.buys >= p.minTrades5m && activity.uniqueBuyers/activity.buys < p.minUniqueBuyerShare) {
    return reject("concentrated_buy_activity");
  }
  factors.liquidity=clamp(.9+5*liquidityChange);
  factors.volume=clamp(.8*acceleration/p.minVolumeAcceleration);
  factors.buyers=clamp(.85*buyRatio/p.minBuyRatio);
  factors.holders=holderGrowth===null ? 0 : clamp(holderGrowth/.05);
  factors.social=evidence.checks?.artificialSocial==="clear" ? evidence.organicSocial ?? 0 : 0;
  if (fallingStructure || pullback === null || pullback < p.minPullback || pullback > p.maxPullback ||
      formation.length < p.higherLows+1 ||
      formation.some((i,j) => j>0 && candles[i]!.low<=candles[formation[j-1]!]!.low)) return finish("unconfirmed_higher_lows");
  states.push("ACCUMULATING");
  const confirmation=candles.slice(-p.confirmationCandles);
  if (resistance === null || finalLow === undefined || confirmation[0]!.openAt <= candles[finalLow]!.openAt ||
      latest.close<=resistance || confirmation.some((c,i)=>c.close<=c.open || i>0 && c.close<=confirmation[i-1]!.close)) {
    return finish("unconfirmed_breakout");
  }
  states.push("REVERSAL_CONFIRMED");
  factors.reversal=1;
  factors.momentum=momentum ? clamp((momentum.rsi-40)/20)*Number(momentum.ema9>=momentum.ema21) : 0;
  if (current.price<=resistance || current.price>latest.close*(1+p.maxPriceExtension)) return finish("breakout_invalid_or_extended");
  if (acceleration<p.minVolumeAcceleration || buyRatio<p.minBuyRatio) return finish("demand_below_floor");
  if (ctx.sellSimulation !== true) return ctx.sellSimulation === false ? reject("sell_simulation_failed") : finish("sell_simulation_unavailable");
  if (!qualifyingOffers(evidence,p,at,earlyMomentum.observedAt,current.price).length) return finish("executable_quote_unavailable_or_expensive");
  const result=finish("score_below_threshold");
  if (result.score<p.minScore) return result;
  if (ctx.rugPassed !== true) return finish("rug_check_required");
  states.push("ENTRY_ELIGIBLE");
  return finish("confirmed_entry");
}

export default {
  id:earlyMomentumId, name:"Early momentum reversal", version:earlyMomentumVersion, defaultEnabled:false, kind:"signal",
  chains:["base","solana","ethereum","arbitrum","bsc","polygon","optimism"],
  assetClasses:["memecoin"], params:earlyMomentumParams,
  evaluate(ctx, raw = {}): Signal | null {
    if (ctx.holding || ctx.chain==="bitcoin") return null;
    const config=earlyMomentumParams.parse(raw);
    const decision=assessEarlyMomentum(ctx,config);
    if (decision.state!=="ENTRY_ELIGIBLE") return null;
    return {strategyId:earlyMomentumId,chain:ctx.chain,token:ctx.token,side:"buy",confidence:decision.score/100,
      reason:decision.reason,proposed:{targetProfitBps:config.takeProfitBps,stopLossBps:config.initialStopBps,timeoutSec:config.maxHoldSec}};
  },
} satisfies Strategy;
