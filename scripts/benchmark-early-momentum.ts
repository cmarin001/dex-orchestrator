import { performance } from "node:perf_hooks";
import { earlyMomentumId, earlyMomentumParams } from "../schemas/early-momentum.js";
import { builtins } from "../src/strategies/builtins.js";
import { Registry } from "../src/strategies/registry.js";
import { assessEarlyMomentum } from "../src/strategies/builtin/early-momentum-reversal.js";
import { replayStrategy, type ReplayPoint } from "../src/learning/replay.js";
import { evidence, momentumContext, route } from "../tests/early-momentum-fixture.js";
import { z } from "zod";

const at=1_800_000_000_000;
const context=momentumContext(at);
const config=earlyMomentumParams.parse({});
const rounds=20_000;
for (let i=0;i<1000;i++) assessEarlyMomentum(context,config);
const latency:number[]=[];
const started=performance.now();
for (let i=0;i<rounds;i++) {
  const before=performance.now();
  if (assessEarlyMomentum(context,config).state!=="ENTRY_ELIGIBLE") throw new Error("Invalid benchmark fixture");
  latency.push(performance.now()-before);
}
const wallMs=performance.now()-started;
latency.sort((a,b)=>a-b);
const p=(q:number)=>Math.round(latency[Math.ceil(rounds*q)-1]!*1000)/1000;
const settings={startingCents:100_000,notionalCents:1000,maxCommittedCents:10_000,minLiquidityUsd:30_000,
  costs:{version:1 as const,feeBps:30,slippageBps:30,fixedCents:1}};

function point(token:string,at:number,options:{price?:number;gross?:number;liquidity?:number;rugPassed?:boolean;sellSimulation?:boolean;offer?:boolean}={}):ReplayPoint {
  const base=momentumContext(at);
  const data=evidence(at);
  data.liquidityUsd=options.liquidity ?? data.liquidityUsd;
  if (options.offer===false) data.offers=[];
  if (options.gross!==undefined) data.liquidation=route(at,options.gross);
  return {token,chain:"base",assetClass:"memecoin",rugPassed:options.rugPassed ?? true,sellSimulation:options.sellSimulation ?? true,
    earlyMomentum:{observedAt:at,data},current:{...base.current,price:options.price ?? 2,
      holders:options.offer===false?100:150,liquidity:data.liquidityUsd}};
}

const feed:ReplayPoint[]=[];
for (const [i,scenario] of ["reversal","collapse","delisted","failed-entry","rug-rejected","insufficient-liquidity"].entries()) {
  const now=at+i*3_600_000;
  feed.push(point(scenario,now-300_000,{offer:false}));
  feed.push(point(scenario,now,{rugPassed:scenario!=="rug-rejected",
    liquidity:scenario==="insufficient-liquidity"?5000:undefined}));
  feed.push(point(scenario,now+5000,{sellSimulation:scenario!=="failed-entry",rugPassed:scenario!=="rug-rejected",
    liquidity:scenario==="insufficient-liquidity"?5000:undefined}));
  if (scenario==="reversal") {
    feed.push(point(scenario,now+30_000,{price:2.4,gross:1200}),point(scenario,now+60_000,{price:2.2,gross:1090}));
  } else if (scenario==="collapse") {
    feed.push(point(scenario,now+30_000,{price:.5,gross:220,liquidity:10_000,rugPassed:false}));
  } else if (scenario==="delisted") {
    feed.push(point(scenario,now+30_000,{price:.02,offer:false,liquidity:0,rugPassed:false}),
      point(scenario,now+3_700_000,{price:.01,offer:false,liquidity:0,rugPassed:false}));
  }
}
feed.sort((a,b)=>a.current.at-b.current.at);
const registry=new Registry();
const compared=builtins.filter(s=>["dip-buy","new-pair-momentum","momentum-ladder","new-pool-snipe",earlyMomentumId].includes(s.id));
const model=compared.find(s=>s.id===earlyMomentumId)!;
const baselines=[
  {...model,id:"no-trade",params:z.strictObject({}),evaluate:()=>null},
  {...model,id:"combined-deterministic",params:z.strictObject({}),evaluate:(ctx:typeof context)=>registry.decide(ctx,{}, {mode:"weighted"})},
];
console.log(JSON.stringify({node:process.version,rounds,throughputPerSec:Math.round(rounds/(wallMs/1000)),
  latencyMs:{p50:p(.5),p95:p(.95),p99:p(.99)},fixtureEvents:feed.length,
  comparison:[...compared,...baselines].map(s=>replayStrategy(s,{},feed,settings))},null,2));
