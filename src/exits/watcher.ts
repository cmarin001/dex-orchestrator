import { setTimeout as sleep } from "node:timers/promises";
import { isFresh } from "../cache/ttl.js";
import type { Audit } from "../logging/logger.js";
import { failureKind, log, withLogContext } from "../logging/operational.js";
import { CandidateError, SystemError } from "../orchestrator/errors.js";
import type { Equity } from "../state/equity.js";
import type { Positions } from "../state/positions.js";
import { dexScreener } from "../tools/dexscreener.js";
import { activeTarget, canExit } from "./policy.js";

export async function watchPositions(positions: Positions, equity: Equity, audit: Audit, signal: AbortSignal, refreshMs = 5000) {
  log("info", "watcher.started");
  const targets = new Map<string, number>();
  while (!signal.aborted) {
    for (const position of positions.list()) {
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
      const previous = targets.get(run_id) ?? activeTarget(policy, policy.entry_at);
      if (previous !== active) {
        await audit({ identity, stage: "exit_target_changed", status: "ok", gaps: [], detail: { previous, active } });
        targets.set(run_id, active);
        log("info", "position.exit_target_changed", fields);
      }
      if (!isFresh(observed, 15_000) || signal.aborted || !canExit(policy, { price, at })) continue;
      const proceeds = Math.round(cost_cents * price / policy.entry_price);
      if (!Number.isSafeInteger(proceeds)) throw new SystemError("Invalid simulated proceeds");
      const exit_reason = price < policy.entry_price ? "stop" : at - policy.entry_at >= policy.max_hold_sec * 1000
        ? "timeout" : "target";
      await audit({ identity, stage: "executor", status: "paper_close", gaps: [], position,
        close: { exit_at: at, exit_price: price, exit_reason, proceeds_cents: proceeds } });
      positions.close(position);
      equity.close(position, proceeds, at);
      log("info", "position.closed", { ...fields, outcome: "paper_close", reason: exit_reason });
      targets.delete(run_id);
    }
    await sleep(refreshMs, undefined, { signal }).catch(error => { if (!signal.aborted) throw error; });
  }
  log("info", "watcher.stopped");
}
