import { checks as checksRawSchema } from "../../schemas/recon-snapshot.js";
import { z } from "zod";
import { CandidateError } from "../orchestrator/errors.js";
import type { Handoff } from "../../schemas/common.js";
import { rugCheckSchema } from "../../schemas/rug-check.js";
import type { RugChecksRaw } from "../../schemas/rug-check.js";
import { scannerRowSchema } from "../../schemas/scanner.js";
import { matchesIdentity, type CallAgent } from "./call.js";

export const rugInput = scannerRowSchema.extend({ checks_raw: checksRawSchema });
export function rugCheck(call: CallAgent, identity: Handoff, candidate: z.input<typeof rugInput>) {
  const data = rugInput.parse(candidate);
  const checks = safetyChecks(data.checks_raw, data.age_sec);
  const failed = Object.values(checks).includes(false);
  const critical = [
    "renounced",
    "mint_auth_disabled",
    "freeze_auth_disabled",
    "lp_locked_or_burned",
    "honeypot_sim_ok",
  ] as const;
  const missingCritical = critical.some((field) => data.checks_raw[field] == null);
  const missingOptional = ["tax_bps", "blacklist_present", "deployer_rugged_before", "holder_top10_pct"].some(
    (field) => data.checks_raw[field as keyof typeof data.checks_raw] == null,
  );
  return call({
    prompt: "rug-check",
    schema: rugCheckSchema,
    identity,
    data,
    local: () => ({...identity,checks,verdict:failed?"FAIL":"PASS",
      reason:missingCritical?"ambiguous critical evidence":failed?"failed safety check":missingOptional?"optional evidence unavailable":"clear"}),
    validate: (out) =>
      matchesIdentity(out, identity) &&
      out.verdict === (failed ? "FAIL" : "PASS") &&
      (!missingCritical || out.reason.toLowerCase().includes("ambiguous critical")) &&
      (failed || !missingOptional || /missing|unknown|unavailable|absent/i.test(out.reason)) &&
      Object.entries(checks).every(([key, value]) => out.checks[key as keyof typeof checks] === value) &&
      !!out.reason.trim(),
  });
}

declare const clearRisk: unique symbol;
export type RugCheckPass = z.infer<typeof rugCheckSchema> & { verdict: "PASS"; readonly [clearRisk]: true };

export function requireRugCheckPass(
  security: "clear" | "unknown" | "flagged",
  result: z.infer<typeof rugCheckSchema>,
  raw: RugChecksRaw,
  ageSec: number,
): RugCheckPass {
  if (security !== "clear" || result.verdict !== "PASS" || Object.values(safetyChecks(raw, ageSec)).includes(false)) {
    throw new CandidateError("risk_not_clear");
  }
  return result as RugCheckPass;
}

function safetyChecks(raw: RugChecksRaw, age_sec: number) {
  return {
    renounced: raw.renounced === true,
    mint_auth: raw.mint_auth_disabled === true,
    freeze_auth: raw.freeze_auth_disabled === true,
    lp_locked_or_burned: raw.lp_locked_or_burned === true,
    honeypot: raw.honeypot_sim_ok === true,
    tax_ok: (raw.tax_bps ?? 0) <= 1000,
    blacklist: raw.blacklist_present !== true,
    deployer_ok: raw.deployer_rugged_before !== true,
    age_ok: age_sec >= 600,
    holder_conc_ok: (raw.holder_top10_pct ?? 0) <= 40,
  };
}
