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
type ReplayPoint=Pick<StrategyContext,"chain"|"token"|"assetClass"|"rugPassed"|"current">;
type Open={entry:number;cost:number;at:number;target:number;stop:number;timeout:number};

/** Each signal may fill at the next observation only. All histories are scoped to the current asset and time. */
export function replayStrategy(strategy:Strategy,params:unknown,feed:readonly ReplayPoint[],settings:Settings) {
  if (![settings.startingCents,settings.notionalCents,settings.maxCommittedCents].every(v=>Number.isSafeInteger(v)&&v>0) ||
      !Number.isFinite(settings.minLiquidityUsd) || settings.minLiquidityUsd<=0) throw new RangeError("Invalid replay settings");
  const open=new Map<string,Open>();
  const stats:Trade[]=[];
  const history=new Map<string,ReplayPoint["current"][]>();
  const pending=new Map<string,NonNullable<ReturnType<Strategy["evaluate"]>>>();
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
    if (position && liquid) {
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
      const price=paperEntry(cost,current.price,0,settings.costs);
      if (!open.has(key) && liquid && point.rugPassed===true && capacity>=cost && price!==null) {
        const {targetProfitBps,stopLossBps,timeoutSec}=previous.proposed;
        open.set(key,{cost,entry:price,at:current.at,target:targetProfitBps/10_000,stop:stopLossBps/10_000,timeout:timeoutSec*1000});
        committed+=cost;
      } else failedEntries++;
    }
    if (!open.has(key) && liquid && point.rugPassed===true && strategy.chains.includes(chain) &&
        (!point.assetClass || strategy.assetClasses.includes(point.assetClass))) {
      const decision=strategy.evaluate({...point,history:observations},configuration);
      if (decision?.side==="buy" && decision.chain===chain && decision.token===token) pending.set(key,decision);
    }
    history.set(key,[...observations.filter(row=>row.at>=current.at-25*3_600_000),current].slice(-1500));
  }
  return {strategy:strategy.id,version:strategy.version,failedEntries,openPositions:open.size,
    pendingEntries:pending.size,committedCents:committed,performance:performanceSummary(stats,settings.startingCents)};
}
