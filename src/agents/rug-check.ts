import type { z } from "zod";
import { CandidateError } from "../orchestrator/errors.js";
import type { Handoff } from "../../schemas/common.js";
import { rugCheckSchema } from "../../schemas/rug-check.js";
import type { RugChecksRaw } from "../../schemas/rug-check.js";
import type { ScannerRow } from "../../schemas/scanner.js";
import type { CallAgent } from "./call.js";

export const rugCheck = (call: CallAgent, identity: Handoff, data: ScannerRow & { checks_raw: RugChecksRaw }) =>
  call({ prompt: "rug-check", schema: rugCheckSchema, identity, data });

declare const clearRisk: unique symbol;
export type RugCheckPass = z.infer<typeof rugCheckSchema> & { verdict: "PASS"; readonly [clearRisk]: true };

export function requireRugCheckPass(security: "clear" | "unknown" | "flagged", result: z.infer<typeof rugCheckSchema>,
  raw: RugChecksRaw, ageSec: number): RugCheckPass {
  if (security !== "clear" || result.verdict !== "PASS" || raw.renounced !== true ||
      raw.mint_auth_disabled !== true || raw.freeze_auth_disabled !== true ||
      raw.lp_locked_or_burned !== true || raw.honeypot_sim_ok !== true ||
      (raw.tax_bps ?? 0) > 1000 || raw.blacklist_present === true ||
      raw.deployer_rugged_before === true || ageSec < 600 || (raw.holder_top10_pct ?? 0) > 40) {
    throw new CandidateError("risk_not_clear");
  }
  return result as RugCheckPass;
}
