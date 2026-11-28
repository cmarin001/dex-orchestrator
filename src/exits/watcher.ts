import { managedPolicy, type MomentumPositions } from "../strategies/early-momentum/monitor.js";
import { liquidationValue } from "../strategies/early-momentum/quotes.js";
import type { PaperClose } from "../../schemas/trade-history.js";
import type { Position } from "../state/positions.js";
import type { LogHop } from "../../schemas/logger.js";
import { executor } from "../agents/executor.js";
import { equityCurve } from "../agents/equity-curve.js";
import { logger } from "../agents/logger.js";
import type { CallAgent } from "../agents/call.js";
import { chartPointSchema } from "../../schemas/live-view.js";
import type { Handoff as PositionIdentity } from "../../schemas/common.js";
import { tradeKey } from "../../schemas/common.js";
import { setTimeout as sleep } from "node:timers/promises";
import { isFresh } from "../cache/ttl.js";
import type { Audit } from "../logging/logger.js";
import { failureKind, log, withLogContext } from "../logging/operational.js";
import { CandidateError, SystemError } from "../orchestrator/errors.js";
import type { Equity } from "../state/equity.js";
import type { Positions } from "../state/positions.js";
import type { LiveExecution } from "../wallet/live.js";
import type { ModeRuntime } from "../mode/runtime.js";
import { marketMarkSchema, type MarketMarkProvider } from "../market-data/contract.js";
import { dexScreenerMarks } from "../market-data/dexscreener.js";
import { activeTarget, canExit, stopLossTriggered } from "./policy.js";
import { paperProceeds } from "../domain/paper-costs.js";
import { localAgent } from "../mode/local-agent.js";

export async function watchPositions(positions: Positions, equity: Equity, audit: Audit, signal: AbortSignal, _call: CallAgent, refreshMs = 5000, requestedExits = new Set<string>(), live?: LiveExecution, liveSlippage?: () => Promise<number>, mode?:ModeRuntime, flattenRequested: () => boolean = () => false, discretionaryExitsPaused: () => boolean = () => false, marks:MarketMarkProvider=dexScreenerMarks, momentum?:MomentumPositions) {
  log("info", "watcher.started");
  const targets = new Map<string, number>();
  while (!signal.aborted) {
    if (momentum && positions.list().some(position=>managedPolicy(position.exit_policy))) {
      await momentum.evidence.refresh(Date.now()).catch(error=>{
        log("warn","position.momentum_evidence_unavailable",{failure_kind:failureKind(error)});
      });
    }
    for (const position of positions.list().sort((a,b) => Number(requestedExits.has(tradeKey(b))) - Number(requestedExits.has(tradeKey(a))))) {
      const { exit_policy: policy, run_id, chain, token, pair, cost_cents } = position;
      if (!policy || signal.aborted) continue;
      const identity = { run_id, chain, token, pair };
      const fields = { run_id, chain };
      if (managedPolicy(policy)) {
        if (!momentum || live) continue;
        const forced=flattenRequested() || requestedExits.has(tradeKey(identity));
        const at=Date.now();
        const {state,quote}=await momentum.check(position,at,forced,audit,!discretionaryExitsPaused());
        if (!quote || signal.aborted || quote.expiresAt<=Date.now()) continue;
        const proceeds=liquidationValue(quote);
        const price=quote.grossCents/100/quote.tokenAmount;
        equity.markValue(position,proceeds,quote.observedAt);
        await audit({identity,stage:"position_mark",status:"ok",gaps:[],detail:{t:quote.observedAt,price,source:"aggregated"}});
        if (!state.pending || signal.aborted || quote.expiresAt<=Date.now()) continue;
        if (!forced && (await mode?.exitSignal(identity,false))?.allowed===false) {
          await audit({identity,stage:"early_momentum_exit_blocked",status:"skipped",gaps:["sell_simulation_guard"]});
          continue;
        }
        if (signal.aborted || quote.expiresAt<=Date.now()) continue;
        const exit_reason=state.pending==="manual_or_emergency"?"manual":state.pending==="fixed_profit"?"target":
          state.pending==="time_limit"?"timeout":"stop";
        await settlePaper(position,{exit_at:at,exit_price:price,exit_reason,proceeds_cents:proceeds},
          momentum.exitDetail(position,state,quote,at));
        momentum.closed(position,at);
        await publishClose(identity,[]);
        continue;
      }
      const observed = Date.now();
      let price: number;
      let source: string;
      try {
        const mark=marketMarkSchema.safeParse(await withLogContext(fields, () => marks.mark(identity,signal)));
        if (!mark.success) throw new CandidateError("Invalid market mark");
        ({price_usd:price,source}=mark.data);
      }
      catch (error) {
        log("warn", "position.mark_failed", { ...fields, failure_kind: failureKind(error) });
        if (!(error instanceof CandidateError || error instanceof SystemError)) throw error;
        await audit({ identity, stage: "position_mark", status: "failed", gaps: [error.name], detail: error.message });
        continue;
      }
      const at = Date.now();
      if (!isFresh(observed, 15_000, at) || signal.aborted) {
        log("debug", "position.mark_discarded", { ...fields, reason: signal.aborted ? "shutdown" : "stale_quote" });
        continue;
      }
      const compatibleSource=chartPointSchema.shape.source.safeParse(source);
      await audit({ identity, stage: "position_mark", status: "ok", gaps: [],
        detail: { t: observed, price, source:compatibleSource.data ?? "aggregated" } });
      log("debug","position.marked",{...fields,provider:source});
      equity.mark(position, price, observed);
      const active = activeTarget(policy, at);
      const previous = targets.get(tradeKey(identity)) ?? activeTarget(policy, policy.entry_at);
      if (previous !== active) {
        await audit({ identity, stage: "exit_target_changed", status: "ok", gaps: [], detail: { previous, active } });
        targets.set(tradeKey(identity), active);
        log("info", "position.exit_target_changed", fields);
      }
      if (!isFresh(observed, 15_000) || signal.aborted) continue;
      const forced = flattenRequested() || requestedExits.has(tradeKey(identity));
      const protective = stopLossTriggered(policy, { price, at });
      const proposed = forced ? undefined : await mode?.exitSignal(identity,
        !protective && policy.mode === "stop_loss" && !discretionaryExitsPaused());
      const timedByStrategy = !protective && proposed?.exit === true && !discretionaryExitsPaused();
      if (!forced && (proposed?.allowed === false ||
          (!protective && !timedByStrategy && !canExit(policy, { price, at })))) continue;
      // Position monitoring keeps the existing Executor handoff on the local path.
      const decision = forced ? null : await executor(localAgent, identity, { action:"exit",sizer:{status:"SIZED",size_usd:cost_cents/100,max_slippage_bps:0},
        position:{entry_price:policy.entry_price,opened_at:Math.floor(policy.entry_at/1000),max_hold_sec:timedByStrategy ? 1 : policy.max_hold_sec,
          stop_loss_bps:policy.mode==="stop_loss"?policy.stop_loss_bps:10000,take_profit_bps:active},
        market:{quote_price:price,expected_slippage_bps:0,gas_usd:0,now:Math.floor(at/1000)} });
      if (decision) await audit({ identity,stage:"executor",status:"ok",gaps:[],detail:decision });
      if ((!protective && decision && decision.status !== "FILLED") || !isFresh(observed,15000) || signal.aborted) continue;
      const proceeds = position.paper_costs
        ? paperProceeds(cost_cents,position.entry_price_usd,price,position.paper_costs)
        : Math.round(cost_cents * price / policy.entry_price);
      if (!Number.isSafeInteger(proceeds)) throw new SystemError("Invalid simulated proceeds");
      const exit_reason = forced ? "manual" : price < policy.entry_price ? "stop" : timedByStrategy || at - policy.entry_at >= policy.max_hold_sec * 1000
        ? "timeout" : "target";
      if (live) {
        if (await live.exit(position,price,await liveSlippage?.() ?? 0,exit_reason)) {
          targets.delete(tradeKey(identity));
          requestedExits.delete(tradeKey(identity));
          await publishClose(identity,decision?[{agent:"executor",output:decision}]:[]);
        }
        continue;
      }
      await settlePaper(position,{exit_at:at,exit_price:price,exit_reason,proceeds_cents:proceeds});
      await publishClose(identity,decision?[{agent:"executor",output:decision}]:[]);
    }
    await sleep(refreshMs, undefined, { signal }).catch(error => { if (!signal.aborted) throw error; });
  }
  async function settlePaper(position:Position,close:PaperClose,detail?:unknown) {
    const { run_id, chain, token, pair }=position;
    const identity={run_id,chain,token,pair};
    await audit({identity,stage:"executor",status:"paper_close",gaps:[],position,close,detail});
    positions.close(position);
    equity.close(position,close.proceeds_cents,close.exit_at);
    mode?.plane.noteClose(chain,close.proceeds_cents-position.cost_cents);
    log("info","position.closed",{run_id,chain,outcome:"paper_close",reason:close.exit_reason});
    targets.delete(tradeKey(position));
    requestedExits.delete(tradeKey(position));
  }

  async function publishClose(identity:PositionIdentity,hops:LogHop[]) {
    const projection=await equityCurve(localAgent,identity,{starting_equity_usd:equity.initialCents/100,
      closed_trades:equity.closedTrades(),as_of:Math.floor(Date.now()/1000)});
    await audit({identity,stage:"equity-curve",status:"ok",detail:projection,gaps:[]});
    const trace=await logger(localAgent,identity,[...hops,{agent:"equity",output:projection}]);
    await audit({identity,stage:"logger",status:"ok",detail:trace,gaps:trace.rows.flatMap(row=>row.gaps)});
  }
  log("info", "watcher.stopped");
}
