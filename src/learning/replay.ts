import { recordedEntryReviewSchema, type RecordedEntryReview } from "./recorded-entry-review.js";
import { earlyMomentumId, earlyMomentumParams } from "../../schemas/early-momentum.js";
import { defaultRisk } from "../../schemas/risk-config.js";
import type { Position } from "../state/positions.js";
import { momentumExitPolicy, selectMomentumOffer } from "../strategies/early-momentum/entry.js";
import { advanceMomentum, initialMonitor, managedPolicy, type MonitorState } from "../strategies/early-momentum/monitor.js";
import { liquidationValue, quoteCosts } from "../strategies/early-momentum/quotes.js";
import type { Strategy, StrategyContext } from "../strategies/strategy.js";
import { paperEntry, paperProceeds, type PaperCosts } from "../domain/paper-costs.js";
import { performanceSummary, type Trade } from "./metrics.js";

type Settings={
  startingCents:number;
  notionalCents:number;
  maxCommittedCents:number;
  minLiquidityUsd:number;
  costs:PaperCosts;
};
export type ReplayPoint=Pick<StrategyContext,"chain"|"token"|"assetClass"|"rugPassed"|"current"|"earlyMomentum"|"sellSimulation"> & {pair?:string; entryReview?:RecordedEntryReview};
type Open={entry:number;cost:number;at:number;target:number;stop:number;timeout:number; managed?:{position:Position;state:MonitorState}};

/** Each signal may fill at the next observation only. All histories are scoped to the current asset and time. */
export function replayStrategy(strategy:Strategy,params:unknown,feed:readonly ReplayPoint[],settings:Settings,options:{requireEntryReview?:boolean}={}) {
  if (![settings.startingCents,settings.notionalCents,settings.maxCommittedCents].every(v=>Number.isSafeInteger(v)&&v>0) ||
      !Number.isFinite(settings.minLiquidityUsd) || settings.minLiquidityUsd<=0) throw new RangeError("Invalid replay settings");
  const open=new Map<string,Open>();
  const stats:Trade[]=[];
  const cooldown=new Map<string,number>();
  const emrs=strategy.id===earlyMomentumId ? earlyMomentumParams.parse(params):undefined;
  let fillCount=0;
  let attemptsWithoutRoute=0;
  const history=new Map<string,ReplayPoint["current"][]>();
  const pending=new Map<string,{proposal:NonNullable<ReturnType<Strategy["evaluate"]>>;observedAt:number;
    pair?:string;review?:RecordedEntryReview}>();
  const consumedReviews=new Set<string>();
  const reviewCounts={approved:0,declined:0,unavailable:0};
  let committed=0,capital=settings.startingCents,previousAt=-Infinity,failedEntries=0;
  const configuration=strategy.params.parse(params);
  for (const point of feed) {
    const {current,chain,token}=point;
    if (!Number.isSafeInteger(current.at) || current.at<previousAt || !Number.isFinite(current.price) ||
        current.price<=0 || !Number.isFinite(current.liquidity) || current.liquidity<0) throw new RangeError("Invalid chronological replay data");
    previousAt=current.at;
    const key=JSON.stringify([chain,token]);
    const observations=history.get(key) ?? [];
    if (observations.at(-1)?.at===current.at) throw new Error("DUPLICATE_REPLAY_OBSERVATION");
    const liquid=current.liquidity>=settings.minLiquidityUsd;
    const position=open.get(key);
    if (position?.managed) {
      const {position:paper,state}=position.managed;
      const evidence=point.earlyMomentum;
      const decision=advanceMomentum(paper,state,evidence?{fetched_at:evidence.observedAt,early_momentum:evidence.data}:undefined,current.at,false);
      position.managed.state=decision.state;
      if (decision.state.pending && !decision.quote && !state.pending) attemptsWithoutRoute++;
      if (decision.state.pending && decision.quote) {
        const proceeds=liquidationValue(decision.quote);
        const pnlCents=proceeds-position.cost;
        open.delete(key);
        capital+=pnlCents;
        committed-=position.cost;
        const rules=managedPolicy(paper.exit_policy)!;
        cooldown.set(key,current.at+rules.cooldownSec*1000);
        stats.push({pnlCents,costCents:position.cost,openedAt:position.at,closedAt:current.at,
          mfeCents:decision.state.highestCents-position.cost,maeCents:decision.state.lowestCents-position.cost,
          feesCents:rules.entryCostsCents+quoteCosts(decision.quote)});
      }
    } else if (position && liquid && point.sellSimulation!==false) {
      const move=current.price/position.entry-1;
      if (move>=position.target || move<=-position.stop || current.at-position.at>=position.timeout) {
        const proceeds=paperProceeds(position.cost,position.entry,current.price,settings.costs);
        const pnlCents=proceeds-position.cost;
        open.delete(key);
        capital+=pnlCents;
        committed-=position.cost;
        stats.push({pnlCents,costCents:position.cost,openedAt:position.at,closedAt:current.at});
      }
    }
    const previous=pending.get(key);
    if (previous) {
      pending.delete(key);
      const capacity=Math.min(capital,settings.maxCommittedCents)-committed;
      const cost=settings.notionalCents;
      let reviewAllowed=true;
      if (options.requireEntryReview) {
        const review=previous.review;
        if (!review || consumedReviews.has(review.id) || previous.pair!==point.pair || review.availableAt<previous.observedAt ||
            review.availableAt>current.at || review.expiresAt<=current.at) {
          reviewCounts.unavailable++;
          reviewAllowed=false;
        } else {
          consumedReviews.add(review.id);
          reviewAllowed=review.decision==="buy";
          if (reviewAllowed) reviewCounts.approved++;
          else reviewCounts.declined++;
        }
      }
      const permitted=reviewAllowed && !open.has(key) && liquid && point.rugPassed===true && point.sellSimulation!==false && capacity>0;
      const {targetProfitBps,stopLossBps,timeoutSec}=previous.proposal.proposed;
      const base={at:current.at,target:targetProfitBps/10_000,stop:stopLossBps/10_000,timeout:timeoutSec*1000};
      let fill:Open|undefined;
      if (emrs && permitted && chain!=="bitcoin" && point.earlyMomentum && point.sellSimulation===true) {
        const {data,observedAt}=point.earlyMomentum;
        const offer=selectMomentumOffer(data,emrs,current.at,observedAt,current.price,Math.min(cost,capacity),defaultRisk.max_slippage_bps);
        if (offer && data.liquidityUsd>=emrs.minLiquidityUsd) {
          const commitment=offer.buy.grossCents+quoteCosts(offer.buy);
          const entry=commitment/100/offer.buy.tokenAmount;
          const exit_policy=momentumExitPolicy(emrs,offer,current.price,data.liquidityUsd,current.at);
          const paper:Position={chain,token,pair:point.pair ?? token,run_id:String(current.at),entry_price_usd:entry,
            cost_cents:commitment,strategy_id:strategy.id,exit_policy};
          fill={...base,cost:commitment,entry,managed:{position:paper,state:initialMonitor(paper)}};
        }
      } else if (!emrs && permitted && capacity>=cost) {
        const entry=paperEntry(cost,current.price,0,settings.costs);
        if (entry!==null) fill={...base,cost,entry};
      }
      if (fill) {
        open.set(key,fill);
        committed+=fill.cost;
        fillCount++;
      } else failedEntries++;
    }
    if (!open.has(key) && (cooldown.get(key) ?? 0)<=current.at && liquid && point.rugPassed===true && strategy.chains.includes(chain) &&
        (!point.assetClass || strategy.assetClasses.includes(point.assetClass))) {
      const evidence=point.earlyMomentum;
      const candles=evidence && evidence.observedAt<=current.at ? evidence.data.candles
        .filter(c=>c.openAt+60_000<=evidence.observedAt).sort((a,b)=>a.openAt-b.openAt)
        .map(c=>({open:c.open,close:c.close,interval:1,volume:c.volumeUsd})) : undefined;
      const decision=strategy.evaluate({...point,asOf:current.at,candles,history:observations},configuration);
      if (decision?.side==="buy" && decision.chain===chain && decision.token===token) {
        const review=options.requireEntryReview ? recordedEntryReviewSchema.safeParse(point.entryReview).data : undefined;
        pending.set(key,{proposal:decision,observedAt:current.at,pair:point.pair,review});
      }
    }
    history.set(key,[...observations.filter(row=>row.at>=current.at-25*3_600_000),current].slice(-1500));
  }
  return {strategy:strategy.id,version:strategy.version,failedEntries,fillCount,exitTriggersWithoutRoute:attemptsWithoutRoute,
    executionSuccessRate:fillCount+failedEntries ? fillCount/(fillCount+failedEntries) : null,openPositions:open.size,
    pendingEntries:pending.size,...(options.requireEntryReview?{entryReviews:reviewCounts}:{}),committedCents:committed,performance:performanceSummary(stats,settings.startingCents)};
}
