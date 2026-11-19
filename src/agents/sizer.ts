import type { Handoff } from "../../schemas/common.js";
import { sizerSchema } from "../../schemas/sizer.js";
import type { CallAgent } from "./call.js";

import type { RugCheckPass } from "./rug-check.js";
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

export const sizer = (call: CallAgent, identity: Handoff, data: { risk: RugCheckPass; [key: string]: unknown }) =>
  call({ prompt: "sizer", schema: sizerSchema, identity, data });
