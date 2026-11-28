import assert from "node:assert/strict";
import { test } from "node:test";
import { earlyMomentumParams } from "../../schemas/early-momentum.js";
import { defaultLadder } from "../../schemas/exit-policy.js";
import type { Position } from "../../src/state/positions.js";
import strategy,{ assessEarlyMomentum } from "../../src/strategies/builtin/early-momentum-reversal.js";
import { advanceMomentum, initialMonitor } from "../../src/strategies/early-momentum/monitor.js";
import { id } from "../agent-fixture.js";
import { evidence, momentumContext, route } from "../early-momentum-fixture.js";

const at=1_800_000_000_000;
const params=earlyMomentumParams.parse({});
const assess=(ctx=momentumContext(at))=>assessEarlyMomentum(ctx,params);
const position=(style:"fixed"|"trailing"="trailing"):Position => ({...id,cost_cents:1000,entry_price_usd:2,
  exit_policy:{mode:"stop_loss",entry_price:2,entry_at:at,min_profit_bps_for_exit:25,max_hold_sec:3600,
    timeout_ladder:defaultLadder,stop_loss_bps:500,early_momentum:{version:1,style,tokenAmount:4.95,
      initialProceedsCents:982,entryCostsCents:8,initialMarketPrice:2,entryLiquidityUsd:100_000,maxEvidenceAgeMs:45_000,
      takeProfitBps:1000,trailActivationBps:1000,trailDistanceBps:500,liquidityDrop:.25,momentumBearCandles:3,cooldownSec:3600}}});
const row=(at:number,grossCents?:number,liquidityUsd=100_000)=>({
  target:id,source:"fixture",fetched_at:at,early_momentum:{...evidence(at),liquidityUsd,
    liquidation:grossCents===undefined?undefined:route(at,grossCents)},
});

test("a causal early reversal reaches eligibility and scores unavailable checks and social conservatively",()=>{
  const ctx=momentumContext(at);
  const result=assess(ctx);
  assert.equal(result.state,"ENTRY_ELIGIBLE",JSON.stringify(result));
  assert.deepEqual(result.states,["DISCOVERED","QUALIFIED","WATCHING","ACCUMULATING","REVERSAL_CONFIRMED","ENTRY_ELIGIBLE"]);
  assert.equal(result.contributions.social,0);
  assert.equal(result.checks.washTrading,"unknown");
  assert.equal(strategy.evaluate(ctx)?.strategyId,"early-momentum-reversal");
  assert.equal(earlyMomentumParams.safeParse({weights:{reversal:.3}}).success,false);
});

test("rejects falling prices and false breakouts, including an unclosed bullish candle",()=>{
  const falling=momentumContext(at);
  falling.earlyMomentum!.data.candles.forEach((c,i)=>Object.assign(c,{open:3-i/30,high:3.01-i/30,low:2.98-i/30,close:2.99-i/30}));
  assert.equal(strategy.evaluate(falling),null);
  const falseBreakout=momentumContext(at);
  const last=falseBreakout.earlyMomentum!.data.candles.at(-1)!;
  last.open=last.close+.01;
  falseBreakout.earlyMomentum!.data.candles.push({...last,openAt:at,open:2,close:2.1,high:2.11,low:1.99});
  assert.equal(assess(falseBreakout).reason,"unconfirmed_breakout");
});

test("insufficient, stale and suspicious evidence or unavailable sell routes fail closed",()=>{
  const cases=[
    ["invalid_volume_baseline",(c:ReturnType<typeof momentumContext>)=>{
      c.earlyMomentum!.data.candles.forEach(row=>{row.volumeUsd=Number.MAX_VALUE;});
    }],
    ["closed_candle_history_unavailable",(c:ReturnType<typeof momentumContext>)=>{c.earlyMomentum!.data.candles=[];}],
    ["missing_or_stale_evidence",(c:ReturnType<typeof momentumContext>)=>{c.asOf=at+46_000;}],
    ["manipulation_or_token_risk",(c:ReturnType<typeof momentumContext>)=>{c.earlyMomentum!.data.checks={artificialVolume:"flagged"};}],
    ["manipulation_or_token_risk",(c:ReturnType<typeof momentumContext>)=>{c.earlyMomentum!.data.checks={copycat:"flagged"};}],
    ["liquidity_deteriorating",(c:ReturnType<typeof momentumContext>)=>{c.earlyMomentum!.data.liquidityUsd=60_000;}],
    ["rug_check_required",(c:ReturnType<typeof momentumContext>)=>{c.rugPassed=false;}],
    ["sell_simulation_failed",(c:ReturnType<typeof momentumContext>)=>{c.sellSimulation=false;}],
    ["executable_quote_unavailable_or_expensive",(c:ReturnType<typeof momentumContext>)=>{c.earlyMomentum!.data.offers[0]!.buy.impactCents=40;}],
    ["executable_quote_unavailable_or_expensive",(c:ReturnType<typeof momentumContext>)=>{c.earlyMomentum!.data.offers[0]!.sell.expiresAt=at;}],
  ] as const;
  for (const [reason,mutate] of cases) {
    const ctx=momentumContext(at);
    mutate(ctx);
    assert.equal(assess(ctx).reason,reason);
    assert.equal(strategy.evaluate(ctx),null);
  }
});

test("trailing stop activates on net value, ratchets up and survives adverse moves",()=>{
  const p=position();
  const initial=initialMonitor(p);
  const up=advanceMomentum(p,initial,row(at+1000,1120),at+1000,false).state;
  assert.equal(up.state,"MOMENTUM_ACTIVE");
  assert.equal(up.trailingCents,1056);
  const higher=advanceMomentum(p,up,row(at+2000,1210),at+2000,false).state;
  assert.equal(higher.trailingCents,1141);
  const down=advanceMomentum(p,higher,row(at+3000,1160),at+3000,false).state;
  assert.equal(down.trailingCents,1141);
  assert.equal(down.pending,undefined);
  const exited=advanceMomentum(p,down,row(at+4000,1135),at+4000,false).state;
  assert.equal(exited.trailingCents,1141);
  assert.equal(exited.pending,"trailing_stop");
});

test("fixed take profit, time, liquidity and emergency rules select the intended exit",()=>{
  const p=position("fixed");
  const start=initialMonitor(p);
  assert.equal(advanceMomentum(p,start,row(at+1000,1104),at+1000,false).state.pending,undefined);
  assert.equal(advanceMomentum(p,start,row(at+1000,1110),at+1000,false).state.pending,"fixed_profit");
  assert.equal(advanceMomentum(p,start,row(at+1000,920),at+1000,false).state.pending,"initial_stop");
  assert.equal(advanceMomentum(p,start,row(at+1000,1000,70_000),at+1000,false).state.pending,"liquidity_deterioration");
  const time=advanceMomentum(p,start,undefined,at+3_600_000,false);
  assert.equal(time.state.pending,"time_limit");
  assert.equal(time.quote,undefined);
  const emergency=advanceMomentum(p,time.state,row(at+3_601_000,959),at+3_601_000,true);
  assert.equal(emergency.state.pending,"manual_or_emergency");
  assert.equal(emergency.quote?.grossCents,959);
});

test("GeckoTerminal maps the documented tuple and excludes the current open interval",async()=>{
  const {geckoMinuteCandles}=await import("../../src/tools/geckoterminal.js");
  const rows=await geckoMinuteCandles(id,at,async request=>{
    const url=new URL(String(request));
    assert.equal(url.searchParams.get("token"),id.token);
    assert.equal(url.searchParams.get("currency"),"usd");
    assert.equal(url.searchParams.get("include_empty_intervals"),"false");
    return Response.json({meta:{base:{address:id.token},quote:{address:id.pair}},
      data:{attributes:{ohlcv_list:[[at/1000,2,3,1,2,500],[(at-60_000)/1000,2,3,1,2,500]]}}});
  });
  assert.deepEqual(rows,[{openAt:at-60_000,open:2,high:3,low:1,close:2,volumeUsd:500}]);
});

test("momentum deterioration is evaluated from closed contiguous bearish candles",()=>{
  const p=position();
  const start=initialMonitor(p);
  const end=at+3*60_000;
  const next=row(end,1000);
  next.early_momentum.candles=[0,1,2].map(i=>({openAt:at+i*60_000,open:2.1-i*.01,high:2.12-i*.01,
    low:2-i*.01,close:2.02-i*.01,volumeUsd:100}));
  assert.equal(advanceMomentum(p,start,next,end,false).state.pending,"momentum_deterioration");
  assert.equal(advanceMomentum(p,start,next,end,false,false).state.pending,undefined);
});
