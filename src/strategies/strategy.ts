import type { z } from "zod";
import type { WalletChain } from "../../schemas/transaction-intent.js";
import type { Signal } from "../../schemas/signal.js";

export type Observation = {
  at:number; source:string; price:number; volume:number; liquidity:number; age:number;
  volume24h?:number; holders?:number|null; top10?:number|null; whaleNet?:number;
  btcPrice?:number; gasUsd?:number; marketCap?:number;
};
export type StrategyContext = {
  token:string; chain:WalletChain; current:Observation; history:readonly Observation[];
  assetClass?:"memecoin"|"utility"|"stable"; holding?:boolean; rugPassed?:boolean; sellSimulation?:boolean;
  candles?: Array<{interval:number;open:number;close:number;volume:number}>;
  walletBuys?: string[];
  performance?: {winRate:number;payoff:number};
};
export interface Strategy {
  id:string;
  name:string;
  version:number;
  chains:WalletChain[];
  assetClasses: ("memecoin"|"utility"|"stable")[];
  params:z.ZodType;
  kind:"signal"|"guard"|"overlay";
  evaluate(ctx:StrategyContext, params?:unknown):Signal|null;
  factor?(ctx:StrategyContext, params:unknown, signals:Signal[]):number;
}

const chains: WalletChain[] = ["base","solana","ethereum","arbitrum","bsc","polygon","optimism"];
const assetClasses = ["memecoin"] as const;
const metadata = (id:string, params:z.ZodType) => ({id,name:id,version:1,chains:[...chains],assetClasses:[...assetClasses],params});
export function signal<S extends z.ZodType>(id:string, params:S,
  test:(ctx:StrategyContext, config:z.infer<S>)=>boolean, side:Signal["side"], exits:[number,number,number]): Strategy {
  return {...metadata(id,params),kind:"signal",evaluate(ctx, raw={}) {
    if (!chains.includes(ctx.chain) || ctx.assetClass && ctx.assetClass !== "memecoin" || !test(ctx,params.parse(raw))) return null;
    const [targetProfitBps,stopLossBps,timeoutSec]=exits;
    return {strategyId:id,token:ctx.token,chain:ctx.chain,side,confidence:.7,reason:id,
      proposed:{targetProfitBps,stopLossBps,timeoutSec}};
  }};
}
export function guard<S extends z.ZodType>(id:string, params:S, test:(ctx:StrategyContext,p:z.infer<S>)=>boolean): Strategy {
  return {...metadata(id,params),kind:"guard",evaluate:()=>null,factor:(ctx,raw)=>Number(test(ctx,params.parse(raw)))};
}
export function overlay<S extends z.ZodType>(id:string, params:S,
  weight:(ctx:StrategyContext,p:z.infer<S>,signals:Signal[])=>number): Strategy {
  return {...metadata(id,params),kind:"overlay",evaluate:()=>null,factor:(ctx,raw,signals)=>weight(ctx,params.parse(raw),signals)};
}

export const window = (ctx:StrategyContext, minutes:number) =>
  ctx.history.filter(row=>row.at<ctx.current.at && row.at>=ctx.current.at-minutes*60_000);
export const baseline = (ctx:StrategyContext, minutes:number) =>
  ctx.history.findLast(row=>row.at<=ctx.current.at-minutes*60_000);
export const mean = (values:number[])=>values.reduce((a,b)=>a+b,0)/values.length;
export const avgVol = (ctx:StrategyContext) => (ctx.current.volume24h ?? 0) / 24;
export const holdingVolume = (ctx:StrategyContext) => avgVol(ctx)>0 && ctx.current.volume>=avgVol(ctx);
export function rsi(closes:number[]) {
  const moves=closes.slice(1).map((v,i)=>v-closes[i]!);
  const gains=mean(moves.map(x=>Math.max(x,0)));
  const losses=mean(moves.map(x=>Math.max(-x,0)));
  return losses ? 100-100/(1+gains/losses) : gains ? 100 : 50;
}
export function correlation(rows:Observation[]) {
  if (rows.length<4 || rows.some(row=>!row.btcPrice)) return 0;
  const x=rows.slice(1).map((v,i)=>v.price/rows[i]!.price-1);
  const y=rows.slice(1).map((v,i)=>v.btcPrice!/rows[i]!.btcPrice!-1);
  const mx=mean(x),my=mean(y);
  const variance=x.reduce((sum,v,i)=>sum+(v-mx)*(y[i]!-my),0);
  const denom=Math.sqrt(x.reduce((sum,v)=>sum+(v-mx)**2,0)*y.reduce((sum,v)=>sum+(v-my)**2,0));
  return denom ? variance/denom : 0;
}
