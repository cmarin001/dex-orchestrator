import { earlyMomentumId, earlyMomentumVersion, earlyMomentumParams } from "../../schemas/early-momentum.js";
import type { Audit } from "../logging/logger.js";
import { assessEarlyMomentum } from "../strategies/builtin/early-momentum-reversal.js";
import type { CallAgent } from "../agents/call.js";
import type { Merged } from "../cache/merge.js";
import { targetKey } from "../cache/merge.js";
import { allocation, memecoinEligible } from "../chain/router.js";
import type { ControlPlane } from "../control/plane.js";
import type { Handoff } from "../../schemas/common.js";
import type { Positions } from "../state/positions.js";
import type { Equity } from "../state/equity.js";
import type { ExitPolicy } from "../../schemas/exit-policy.js";
import type { ScannerRow } from "../../schemas/scanner.js";
import type { Observation, StrategyContext } from "../strategies/strategy.js";
import { AllProvidersDownError, BudgetExhaustedError } from "../providers/types.js";
import { localAgent } from "./local-agent.js";
import { failureKind, log } from "../logging/operational.js";
import { StrategyEvidence } from "../strategies/evidence.js";

export class ModeRuntime {
  private active:"strategies"|"human"|"ai"|"hybrid"|"pause";
  private readonly history=new Map<string,Observation[]>();
  private chainScore = new Map<string,number>();
  rankChains(rows:ScannerRow[]) {
    this.chainScore.clear();
    if (this.chain.mode === "ai-decided" && this.active === "ai") {
      for (const row of rows) if (!row.skipped && !this.chainScore.has(row.chain)) {
        this.chainScore.set(row.chain,1/Math.max(1,row.rank_score));
      }
    } else if (this.chain.mode === "strategy-scored") {
      const settings=this.plane.settings;
      for (const row of rows) {
        const ctx=this.context(row,false);
        if (!ctx || row.skipped) continue;
        const vote=this.plane.registry.decide({...ctx,rugPassed:false},settings.strategies,
          {mode:settings.mode.strategyConsensus,weights:settings.mode.strategyWeights});
        const params=this.momentumConfig();
        const preview=params ? assessEarlyMomentum({...ctx,rugPassed:false},params) : undefined;
        const confidence=Math.max(vote?.side==="buy" ? vote.confidence : 0,
          preview?.reason==="rug_check_required" ? preview.score/100 : 0);
        if (!confidence) continue;
        const weight=confidence*this.plane.performance(row.chain).winRate;
        this.chainScore.set(row.chain,(this.chainScore.get(row.chain) ?? 0)+weight);
      }
    }
  }
  constructor(readonly plane:ControlPlane, private model:CallAgent, private evidence=new StrategyEvidence()) {
    this.active=plane.settings.mode.mode;
  }
  async beginCycle(now=Date.now()) {
    this.active=this.plane.settings.mode.mode;
    this.chainScore.clear();
    await this.evidence.refresh(now).catch(error=>{
      log("warn","strategy.evidence_unavailable",{failure_kind:failureKind(error)});
    });
  }
  allowsJevTrading() { return this.active==="hybrid"; }
  usesTypedDecisions() { return this.active==="ai" || this.active==="hybrid"; }
  usesModels() { return this.active==="ai"; }
  get chain() { return this.plane.settings.chain; }

  readonly call:CallAgent=async request=>{
    const mode=this.plane.settings.mode;
    const advisory=this.active==="hybrid" && mode.aiAdvisory &&
      ((request.prompt==="rug-check" && mode.aiAdvisoryOn.includes("ambiguous_rug") &&
        Object.values((request.data as {checks_raw:Record<string,unknown>}).checks_raw).some(v=>v==null)) ||
      (request.prompt==="scanner" && mode.aiAdvisoryOn.includes("novel_token") &&
        (request.data as {feed:Array<{age_sec:number}>}).feed.some(row=>row.age_sec<=3600)) ||
      (request.prompt==="sizer" && mode.aiAdvisoryOn.includes("signal_disagreement") &&
        this.disagreements.has(targetKey(request.identity))));
    if (this.active!=="ai" && !advisory) return localAgent(request);
    try { return await this.model(request); }
    catch (error) {
      if (!(error instanceof AllProvidersDownError || error instanceof BudgetExhaustedError)) throw error;
      const next=error instanceof AllProvidersDownError ? mode.onAllProvidersDown :
        this.plane.settings.budget.onExhaust==="pause" ? "pause" :
          this.plane.settings.budget.onExhaust==="degrade_to_human" ? "human" : mode.onBudgetExhausted;
      this.active=next;
      await this.plane.noteDegradation(next,error.message);
      return localAgent(request);
    }
  };

  private readonly disagreements = new Set<string>();
  observe(snapshot:Merged) {
    const {identity,feed_entry:feed,quote}=snapshot;
    if (snapshot.stale || !feed || !quote) return;
    const key=targetKey(identity);
    const supplement=this.evidence.get(key,Date.now());
    const entry:Observation={at:quote.fetched_at,source:quote.source,price:quote.value,
      age:feed.age_sec,volume:feed.vol_1h_usd,liquidity:feed.liquidity_usd,
      volume24h:snapshot.volume_24h?.value,marketCap:snapshot.market_cap?.value,
      holders:snapshot.checks_raw.holder_count,top10:snapshot.checks_raw.holder_top10_pct,
      btcPrice:supplement?.btc_price,whaleNet:supplement?.whale_net,gasUsd:supplement?.gas_usd};
    const rows=this.history.get(key) ?? [];
    if (rows.at(-1)?.at===entry.at) return;
    this.history.set(key,[...rows.filter(row=>row.at>=entry.at-25*3_600_000),entry].slice(-1500));
    if (this.history.size>3000) this.history.delete(this.history.keys().next().value!);
  }
  private context(identity:Handoff,holding:boolean,asOf=Date.now()) {
    const history=this.history.get(targetKey(identity)) ?? [];
    const current=history.at(-1);
    const extra=this.evidence.get(targetKey(identity),asOf);
    if (!current) return undefined;
    // A close derived from rolling measurements would not be a real OHLC candle.
    return {token:identity.token,chain:identity.chain,assetClass:"memecoin",current,history,holding,rugPassed:true,asOf,
      earlyMomentum:extra?.early_momentum ? {observedAt:extra.fetched_at,data:extra.early_momentum} : undefined,
      candles:extra?.candles?.filter(c=>c.at<=extra.fetched_at).sort((a,b)=>a.at-b.at),
      walletBuys:extra?.wallet_buys,sellSimulation:extra?.sell_simulation,performance:this.plane.performance(identity.chain)} satisfies StrategyContext;
  }
  cap(identity:Handoff, equity:Equity, positions:Positions) {
    const committed=positions.list().filter(p=>p.chain===identity.chain).reduce((n,p)=>n+p.cost_cents,0);
    let pct=allocation(this.chain,identity.chain);
    if (this.chain.mode==="ai-decided" || this.chain.mode==="strategy-scored") {
      const total=[...this.chainScore.values()].reduce((a,b)=>a+b,0);
      pct=total ? Math.min(pct,(this.chainScore.get(identity.chain) ?? 0)/total) : 0;
    }
    return Math.max(0,Math.floor(equity.markedCapitalCents*pct)-committed);
  }
  momentumEvidence(identity:Handoff,at=Date.now()) {
    const row=this.evidence.get(targetKey(identity),at);
    return row?.early_momentum ? {observedAt:row.fetched_at,data:row.early_momentum} : undefined;
  }

  momentumConfig() {
    const configured=this.plane.settings.strategies[earlyMomentumId];
    return configured?.enabled && this.active!=="ai" && this.active!=="pause" ?
      earlyMomentumParams.safeParse(configured.params ?? {}).data : undefined;
  }

  private readonly momentumDecisions = new Map<string,string>();

  async rejectMomentum(snapshot:Merged,reason:string,audit:Audit,at:number) {
    if (!this.momentumConfig()) return;
    const evidence=this.momentumEvidence(snapshot.identity,at);
    if (!evidence) return;
    const key=targetKey(snapshot.identity);
    const fingerprint=JSON.stringify(["REJECTED",reason,snapshot.quote?.fetched_at,evidence.observedAt]);
    if (this.momentumDecisions.get(key)===fingerprint) return;
    await audit({identity:snapshot.identity,stage:"early_momentum_candidate",status:"skipped",gaps:[reason],
      detail:{strategyId:earlyMomentumId,version:earlyMomentumVersion,state:"REJECTED",
        states:["DISCOVERED","REJECTED"],reason,marketAt:snapshot.quote?.fetched_at,evidenceAt:evidence.observedAt}});
    this.rememberMomentum(key,fingerprint);
  }

  private rememberMomentum(key:string,fingerprint:string) {
    this.momentumDecisions.set(key,fingerprint);
    if (this.momentumDecisions.size>3000) this.momentumDecisions.delete(this.momentumDecisions.keys().next().value!);
  }

  async approve(snapshot:Merged, audit?:Audit, asOf=Date.now()) {
    const {identity,feed_entry:feed,checks_raw:checks}=snapshot;
    if (this.active==="pause" || !feed || !memecoinEligible(this.chain,identity.chain,{
      ageSec:feed.age_sec,liquidityUsd:feed.liquidity_usd,holders:checks.holder_count,top10Pct:checks.holder_top10_pct,
      launchpad:this.evidence.get(targetKey(identity),Date.now())?.launchpad,
    })) return null;
    if (this.active==="ai") return {buy:true,sizeFactor:1, signal:null};
    const ctx=this.context(identity,false,asOf);
    if (!ctx) return null;
    const settings=this.plane.settings;
    const params=this.momentumConfig();
    if (params && audit) {
      const decision=assessEarlyMomentum(ctx,params);
      const key=targetKey(identity);
      const fingerprint=JSON.stringify([decision.state,decision.reason,decision.marketAt,decision.evidenceAt,params]);
      if (this.momentumDecisions.get(key)!==fingerprint) {
        await audit({identity,stage:"early_momentum_candidate",status:decision.state==="ENTRY_ELIGIBLE"?"ok":"skipped",
          gaps:decision.state==="ENTRY_ELIGIBLE"?[]:[decision.reason],detail:{strategyId:earlyMomentumId,
            version:earlyMomentumVersion,rugPassed:true,...decision}});
        this.rememberMomentum(key,fingerprint);
      }
    }
    const result=this.plane.registry.decide(ctx,settings.strategies,{mode:settings.mode.strategyConsensus,weights:settings.mode.strategyWeights,
      minConfidence:settings.mode.strategyMinConfidence,onDisagreement:disagrees=>{
      const key=targetKey(identity);
      if (disagrees) this.disagreements.add(key); else this.disagreements.delete(key);
    }});
    if (!result || result.side!=="buy") return null;
    const {sizeFactor,...signal}=result;
    const momentum=signal.strategyId===earlyMomentumId && params && ctx.earlyMomentum ?
      {params,...ctx.earlyMomentum} : undefined;
    return {buy:true,sizeFactor,signal,momentum};
  }
  async authorize(snapshot:Merged, proposal:NonNullable<Awaited<ReturnType<ModeRuntime["approve"]>>>) {
    if (this.active==="pause") return false;
    const mode=this.plane.settings.mode;
    const needsHuman=this.active==="human" || mode.humanApprovalRequired;
    if (!proposal.signal && !needsHuman) return this.active==="ai";
    const {identity}=snapshot;
    const signal=proposal.signal ?? {strategyId:"ai",chain:identity.chain,token:identity.token,side:"buy" as const,
      confidence:1,reason:"executor_approved",proposed:{targetProfitBps:500,stopLossBps:100,timeoutSec:3600}};
    if (!proposal.signal && this.active==="strategies") return false;
    return this.plane.signal(targetKey(identity),signal,proposal.sizeFactor,needsHuman,mode.humanApprovalTimeoutSec);
  }
  async authorizeJevExit(identity:Handoff) {
    if (!this.allowsJevTrading() || (await this.exitSignal(identity,false)).allowed===false) return false;
    const mode=this.plane.settings.mode;
    if (!mode.humanApprovalRequired) return true;
    return this.plane.signal(targetKey(identity)+":jev-exit",{
      strategyId:"jev",chain:identity.chain,token:identity.token,side:"exit",confidence:1,reason:"discretionary_exit",
      proposed:{targetProfitBps:0,stopLossBps:0,timeoutSec:1},
    },1,true,mode.humanApprovalTimeoutSec);
  }

  async exitSignal(identity:Handoff, allowDiscretionaryExit:boolean) {
    if (this.active==="ai" || this.active==="pause") return {allowed:true,exit:false};
    const ctx=this.context(identity,true);
    const state=this.plane.settings;
    if (state.strategies["honeypot-recheck"]?.enabled && !ctx?.sellSimulation) return {allowed:false,exit:false};
    if (!ctx || !allowDiscretionaryExit) return {allowed:true,exit:false};
    const result=this.plane.registry.decide(ctx,state.strategies,{mode:"single",side:"exit"});
    if (result?.side!=="exit") return {allowed:true,exit:false};
    const {sizeFactor,...signal}=result;
    if (this.active==="human" || state.mode.humanApprovalRequired) {
      return {allowed:true,exit:await this.plane.signal(targetKey(identity)+":exit",signal,sizeFactor,true,state.mode.humanApprovalTimeoutSec)};
    }
    await this.plane.signal(targetKey(identity)+":exit",signal,sizeFactor,false,state.mode.humanApprovalTimeoutSec);
    return {allowed:true,exit:true};
  }
  policy(exit:ExitPolicy, proposal:Awaited<ReturnType<ModeRuntime["approve"]>>) {
    const signal=proposal?.signal;
    if (!signal) return exit;
    const {targetProfitBps,stopLossBps,timeoutSec}=signal.proposed;
    const target=Math.max(1,Math.min(10000,targetProfitBps));
    return {...exit,timeout_ladder:[{at_sec:0,target_profit_bps:target}],
      max_hold_sec:timeoutSec,...(exit.mode==="stop_loss"?{stop_loss_bps:Math.max(1,Math.min(stopLossBps,10000))}:{})};
  }
}
