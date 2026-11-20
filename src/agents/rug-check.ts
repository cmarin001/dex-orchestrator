import type { SecuritySnapshot } from "../../schemas/recon-snapshot.js";
import type { z } from "zod";
import { CandidateError } from "../orchestrator/errors.js";
import type { Handoff } from "../../schemas/common.js";
import { rugCheckSchema } from "../../schemas/rug-check.js";
import type { RugChecksRaw } from "../../schemas/rug-check.js";
import type { CallAgent } from "./call.js";

type RugEvidence = Pick<SecuritySnapshot, "checks_raw" | "provenance" | "sources_disagree"> & { age_sec: number };

export const rugCheck = (call: CallAgent, identity: Handoff, { age_sec, checks_raw, provenance, sources_disagree }: RugEvidence) =>
  call({ prompt: "rug-check", schema: rugCheckSchema, identity,
    data: { ...identity, age_sec, checks_raw, provenance, sources_disagree } });

declare const clearRisk: unique symbol;
export type RugCheckPass = z.infer<typeof rugCheckSchema> & { verdict: "PASS"; readonly [clearRisk]: true };

export function requireRugCheckPass(security: "clear" | "unknown" | "flagged", result: z.infer<typeof rugCheckSchema>,
  raw: RugChecksRaw, ageSec: number): RugCheckPass {
  if (security !== "clear" || result.verdict !== "PASS" || Object.values(safetyChecks(raw, ageSec)).includes(false)) {
    throw new CandidateError("risk_not_clear");
  }
  return result as RugCheckPass;
}

function safetyChecks(raw: RugChecksRaw, age_sec: number) {
  return {
    renounced: raw.renounced === true, mint_auth: raw.mint_auth_disabled === true,
    freeze_auth: raw.freeze_auth_disabled === true, lp_locked_or_burned: raw.lp_locked_or_burned === true,
    honeypot: raw.honeypot_sim_ok === true, tax_ok: (raw.tax_bps ?? 0) <= 1000,
    blacklist: raw.blacklist_present !== true, deployer_ok: raw.deployer_rugged_before !== true,
    age_ok: age_sec >= 600, holder_conc_ok: (raw.holder_top10_pct ?? 0) <= 40,
  };
}

export function evaluateRugCheck(identity: Handoff,
  { checks_raw, provenance, sources_disagree, assessment, age_sec }: RugEvidence & Pick<SecuritySnapshot, "assessment">):
  z.infer<typeof rugCheckSchema> {
  const checks = safetyChecks(checks_raw, age_sec);
  const failed = Object.keys(checks).filter(key => !checks[key as keyof typeof checks]);
  const failedSource = Object.entries(provenance).find(([, item]) => item.ok === false)?.[0];
  const reason = sources_disagree ? "ambiguous critical: conflicting sources"
    : failedSource ? "ambiguous critical: " + failedSource
    : failed.length ? "failed or missing: " + failed.join(", ")
    : assessment !== "clear" ? "security assessment: " + assessment : null;
  const missing = Object.entries({ tax_bps: checks_raw.tax_bps, blacklist_present: checks_raw.blacklist_present,
    deployer_rugged_before: checks_raw.deployer_rugged_before, holder_top10_pct: checks_raw.holder_top10_pct })
    .filter(([, value]) => value == null).map(([field]) => field);
  return { ...identity, verdict: reason ? "FAIL" : "PASS", checks,
    reason: reason ?? (missing.length ? "missing non-critical: " + missing.join(", ") : "passed all checks") };
}
