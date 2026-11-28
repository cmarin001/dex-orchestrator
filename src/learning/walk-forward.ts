import type { Strategy } from "../strategies/strategy.js";
import { replayStrategy } from "./replay.js";

type Feed=Parameters<typeof replayStrategy>[2];
type Settings=Parameters<typeof replayStrategy>[3];
type Window={trainStart:number;split:number;testEnd:number};
type Criteria={minTrades:number;maxRealizedDrawdown:number};

export function walkForward(strategy:Strategy,candidates:readonly unknown[],feed:Feed,settings:Settings,
  windows:readonly Window[],criteria:Criteria) {
  if (candidates.length===0 || candidates.length>32 || windows.length===0 || windows.length>24 ||
      !Number.isSafeInteger(criteria.minTrades) || criteria.minTrades<1 ||
      !Number.isFinite(criteria.maxRealizedDrawdown) || criteria.maxRealizedDrawdown<0 || criteria.maxRealizedDrawdown>1) {
    throw new RangeError("Invalid walk-forward settings");
  }
  let previousEnd=-Infinity;
  return windows.map(window=>{
    const {trainStart,split,testEnd}=window;
    if (![trainStart,split,testEnd].every(Number.isSafeInteger) || trainStart>=split || split>=testEnd || split<previousEnd) {
      throw new RangeError("Invalid walk-forward windows");
    }
    previousEnd=testEnd;
    const training=feed.filter(row=>row.current.at>=trainStart && row.current.at<split);
    const eligible=candidates.map((params,index)=>({index,summary:replayStrategy(strategy,params,training,settings)}))
      .filter(row=>row.summary.performance.trades>=criteria.minTrades && row.summary.performance.maxRealizedDrawdown<=criteria.maxRealizedDrawdown)
      .sort((a,b)=>b.summary.performance.netCents-a.summary.performance.netCents || a.index-b.index);
    const winner=eligible[0];
    if (!winner) return {window,selectedCandidate:null,training:null,holdout:null};
    const holdout=feed.filter(row=>row.current.at>=split && row.current.at<testEnd);
    return {window,selectedCandidate:winner.index,training:winner.summary,
      holdout:replayStrategy(strategy,candidates[winner.index],holdout,settings)};
  });
}
