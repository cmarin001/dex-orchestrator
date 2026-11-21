import { executor } from "../agents/executor.js";
import { equityCurve } from "../agents/equity-curve.js";
import { logger } from "../agents/logger.js";
import type { CallAgent } from "../agents/call.js";
import { tradeKey } from "../../schemas/common.js";
import { setTimeout as sleep } from "node:timers/promises";
import { isFresh } from "../cache/ttl.js";
import type { Audit } from "../logging/logger.js";
import { failureKind, log, withLogContext } from "../logging/operational.js";
import { CandidateError, SystemError } from "../orchestrator/errors.js";
import type { Equity } from "../state/equity.js";
import type { Positions } from "../state/positions.js";
import { dexScreener } from "../tools/dexscreener.js";
import { activeTarget, canExit } from "./policy.js";

export async function watchPositions(positions: Positions, equity: Equity, audit: Audit, signal: AbortSignal, call: CallAgent, refreshMs = 5000, requestedExits = new Set<string>()) {
  log("info", "watcher.started");
  const targets = new Map<string, number>();
  while (!signal.aborted) {
    for (const position of positions.list().sort((a,b) => Number(requestedExits.has(tradeKey(b))) - Number(requestedExits.has(tradeKey(a))))) {
      const { exit_policy: policy, run_id, chain, token, pair, cost_cents } = position;
      if (!policy || signal.aborted) continue;
      const identity = { run_id, chain, token, pair };
      const fields = { run_id, chain };
      const observed = Date.now();
      let price: number;
      try { ({ price_usd: price } = await withLogContext(fields, () => dexScreener(identity))); }
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
      await audit({ identity, stage: "position_mark", status: "ok", gaps: [],
        detail: { t: observed, price, source: "dexscreener" } });
      equity.mark(position, price, observed);
      const active = activeTarget(policy, at);
      const previous = targets.get(tradeKey(identity)) ?? activeTarget(policy, policy.entry_at);
      if (previous !== active) {
        await audit({ identity, stage: "exit_target_changed", status: "ok", gaps: [], detail: { previous, active } });
        targets.set(tradeKey(identity), active);
        log("info", "position.exit_target_changed", fields);
      }
      if (!isFresh(observed, 15_000) || signal.aborted || !canExit(policy, { price, at })) continue;
      const decision = await executor(call, identity, { action:"exit",sizer:{status:"SIZED",size_usd:cost_cents/100,max_slippage_bps:0},
        position:{entry_price:policy.entry_price,opened_at:Math.floor(policy.entry_at/1000),max_hold_sec:policy.max_hold_sec,
          stop_loss_bps:policy.mode==="stop_loss"?policy.stop_loss_bps:10000,take_profit_bps:active},
        market:{quote_price:price,expected_slippage_bps:0,gas_usd:0,now:Math.floor(at/1000)} });
      await audit({ identity,stage:"executor",status:"ok",gaps:[],detail:decision });
      if (decision.status!=="FILLED" || !isFresh(observed,15000) || signal.aborted) continue;
      const proceeds = Math.round(cost_cents * price / policy.entry_price);
      if (!Number.isSafeInteger(proceeds)) throw new SystemError("Invalid simulated proceeds");
      const exit_reason = price < policy.entry_price ? "stop" : at - policy.entry_at >= policy.max_hold_sec * 1000
        ? "timeout" : "target";
      await audit({ identity, stage: "executor", status: "paper_close", gaps: [], position,
        close: { exit_at: at, exit_price: price, exit_reason, proceeds_cents: proceeds } });
      positions.close(position);
      equity.close(position, proceeds, at);
      log("info", "position.closed", { ...fields, outcome: "paper_close", reason: exit_reason });
      targets.delete(tradeKey(identity));
      requestedExits.delete(tradeKey(identity));
      const projection = await equityCurve(call,identity,{starting_equity_usd:equity.initialCents/100,closed_trades:equity.closedTrades(),
        as_of:Math.floor(Date.now()/1000)});
      await audit({identity,stage:"equity-curve",status:"ok",detail:projection,gaps:[]});
      const trace = await logger(call,identity,[{agent:"executor",output:decision},{agent:"equity",output:projection}]);
      await audit({identity,stage:"logger",status:"ok",detail:trace,gaps:trace.rows.flatMap(row=>row.gaps)});
    }
    await sleep(refreshMs, undefined, { signal }).catch(error => { if (!signal.aborted) throw error; });
  }
  log("info", "watcher.stopped");
}
