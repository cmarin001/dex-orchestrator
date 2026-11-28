import type { EarlyMomentumEvidence, MomentumQuote } from "../schemas/early-momentum.js";
import type { StrategyContext } from "../src/strategies/strategy.js";
import { id } from "./agent-fixture.js";

const interval=60_000;
export function route(at:number,grossCents=990,tokenAmount=4.95): MomentumQuote {
  return {observedAt:at,expiresAt:at+30_000,route:"paper_route",tokenAmount,grossCents,
    tradingFeeCents:2,networkFeeCents:1,transferFeeCents:0,slippageCents:2,impactCents:3};
}
export function evidence(at:number):EarlyMomentumEvidence {
  const closedAt=Math.floor(at/interval)*interval;
  const centers=[95,96,97,98,100,104,110,103,98,90,83,91,97,94,86,94,100,96,90,93,98,103,106,108];
  return {poolCreatedAt:closedAt-29*interval,liquidityUsd:100_000,
    priorLiquidityUsd:99_000,priorLiquidityAt:at-5*interval,activity:{buys:40,sells:20,uniqueBuyers:35,priorUniqueBuyers:26,windowSec:300},
    candles:centers.map((close,i)=>({openAt:closedAt-(centers.length-i)*interval,open:(close-1)/54,
      high:(close+1)/54,low:(close-1.25)/54,close:close/54,volumeUsd:i>=21?180+(i-21)*20:100})),
    offers:[{buy:route(at),sell:route(at)}]};
}
export function momentumContext(at:number):StrategyContext {
  const current={at,source:"fixture",price:2,age:1750,volume:20_000,liquidity:100_000,holders:150,top10:10};
  return {chain:id.chain,token:id.token,asOf:at,current,history:[{...current,at:at-5*interval,holders:100}],
    rugPassed:true,sellSimulation:true,earlyMomentum:{observedAt:at,data:evidence(at)}};
}
