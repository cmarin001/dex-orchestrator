import { z } from "zod";
import { defaultLadder, ladderSchema } from "./exit-policy.js";

export const riskConfigSchema = z.strictObject({
  max_risk_pct_per_trade: z.number().positive().max(1),
  max_position_vs_pool_depth: z.number().positive().max(1),
  max_slippage_bps: z.number().int().min(0).max(1000),
  halt_new_entries_dd: z.number().positive().max(1),
  timeout_ladder: ladderSchema,
});
export type RiskConfig = z.infer<typeof riskConfigSchema>;
export const defaultRisk: RiskConfig = {
  max_risk_pct_per_trade: 0.02, max_position_vs_pool_depth: 0.015,
  max_slippage_bps: 150, halt_new_entries_dd: 0.15, timeout_ladder: defaultLadder,
};
export const riskRevisionSchema = z.strictObject({
  as_of: z.number().int().nonnegative(), actor: z.string().min(1), config: riskConfigSchema,
});
export type RiskRevision = z.infer<typeof riskRevisionSchema>;
