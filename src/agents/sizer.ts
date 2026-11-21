import type { Handoff } from "../../schemas/common.js";
import { sizerInputSchema, sizerSchema } from "../../schemas/sizer.js";
import { matchesIdentity } from "./call.js";
import type { CallAgent } from "./call.js";

import type { SizerInput } from "../../schemas/sizer.js";
import type { RiskConfig } from "../../schemas/risk-config.js";
import { log } from "../logging/operational.js";
import { CandidateError } from "../orchestrator/errors.js";

export function riskBudget(risk: RiskConfig, drawdown: number, equity: number, poolUsd: number): number {
  if (drawdown >= risk.halt_new_entries_dd) {
    log("warn", "sizer.breaker_open", { reason: "drawdown_limit" });
    throw new CandidateError("drawdown_circuit_open");
  }
  return Math.floor(Math.min(equity * risk.max_risk_pct_per_trade, poolUsd * 100 * risk.max_position_vs_pool_depth));
}

export function sizer(call: CallAgent, identity: Handoff, data: SizerInput, clock = Date.now) {
  const input = sizerInputSchema.parse({ ...identity, ...data });
  const { equity, config, market } = input;
  const now = Math.floor(clock() / 1000);
  const age = equity ? now - equity.as_of : null;
  const base = (equity?.equity_usd ?? 0) * config.max_risk_pct_per_trade;
  const haircut = market.volatility_pct > 0 ? Math.min(1, 20 / market.volatility_pct) : 1;
  const amount = Math.min(base * haircut, market.liquidity_usd * config.max_position_vs_pool_depth) - market.gas_usd;
  const reason =
    input.rug.verdict !== "PASS"
      ? "rug_not_pass"
      : !equity
        ? "no_equity"
        : age! > config.max_equity_age_sec
          ? "stale_equity"
          : equity.drawdown_pct >= config.halt_new_entries_dd
            ? "drawdown_circuit_breaker"
            : amount <= 0
              ? "size_below_gas"
              : null;
  const close = (a: number, b: number) => Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(b));
  return call({
    prompt: "sizer",
    schema: sizerSchema,
    identity,
    data: input,
    validate: (result) => {
      if (
        !matchesIdentity(result, identity) ||
        result.equity_at_decision !== (equity?.equity_usd ?? null) ||
        result.equity_age_sec !== age ||
        result.max_slippage_bps !== config.max_slippage_bps
      )
        return false;
      if (reason)
        return (
          result.reason === reason && result.status === (reason === "drawdown_circuit_breaker" ? "HALTED" : "REFUSED")
        );
      return (
        result.status === "SIZED" &&
        close(result.size_usd, amount) &&
        /[0-9]/.test(result.reason) &&
        (market.reference_price
          ? result.size_tokens !== null && close(result.size_tokens, amount / market.reference_price)
          : result.size_tokens === null)
      );
    },
  });
}
