import { z } from "zod";
import { targetSchema } from "./common.js";
import { scannerFeedFields } from "./scanner.js";

const time = z.number().int().nonnegative();
const sourcedNumber = z.strictObject({ value: z.number(), source: z.string().min(1), fetched_at: time });
const checks = z.strictObject({
  renounced: z.boolean().nullish(), mint_auth_disabled: z.boolean().nullish(),
  freeze_auth_disabled: z.boolean().nullish(), lp_locked_or_burned: z.boolean().nullish(),
  honeypot_sim_ok: z.boolean().nullish(), blacklist_present: z.boolean().nullish(),
  deployer_rugged_before: z.boolean().nullish(), tax_bps: z.number().nonnegative().nullish(),
  holder_top10_pct: z.number().min(0).max(100).nullish(),
});
export const marketSnapshotSchema = z.strictObject({
  source_fetched_at: time,
  trigger: scannerFeedFields.trigger,
  price_usd: sourcedNumber.extend({ value: z.number().positive() }),
  liquidity_usd: sourcedNumber.extend({ value: z.number().nonnegative() }),
  vol_1h_usd: sourcedNumber.extend({ value: z.number().nonnegative() }),
  age_sec: sourcedNumber.extend({ value: z.number().nonnegative() }),
});
export const securitySnapshotSchema = z.strictObject({
  source_fetched_at: time,
  assessment: z.enum(["clear", "flagged", "unknown"]),
  checks_raw: checks,
  sources_disagree: z.boolean(),
  provenance: z.record(z.string(), z.strictObject({ source: z.string().min(1), fetched_at: time, ok: z.boolean().optional() })),
});
export const socialSnapshotSchema = sourcedNumber.extend({ value: z.number().min(0).max(1) });
export const reconSnapshotSchema = z.strictObject({
  target: targetSchema,
  market: marketSnapshotSchema.optional(),
  security: securitySnapshotSchema.optional(),
  social: socialSnapshotSchema.nullish(),
  market_failed_at: time.optional(),
});
export type ReconSnapshot = z.infer<typeof reconSnapshotSchema>;
export type MarketSnapshot = z.infer<typeof marketSnapshotSchema>;
export type SecuritySnapshot = z.infer<typeof securitySnapshotSchema>;
