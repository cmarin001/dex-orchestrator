import { z } from "zod";
import { handoff } from "./common.js";

export const sizerSchema = z.strictObject({
  ...handoff,
  status: z.enum(["SIZED", "REFUSED", "HALTED"]),
  size_usd: z.number().nonnegative(),
  size_tokens: z.number().nonnegative().nullable(),
  max_slippage_bps: z.number().int().nonnegative(),
  equity_at_decision: z.number().nonnegative().nullable(),
  equity_age_sec: z.number().nonnegative().nullable(),
  risk_pct_used: z.number().min(0).max(1),
  reason: z.string(),
});

export const sizerInputSchema = z.strictObject({
  ...handoff,
  rug: z.strictObject({ verdict: z.enum(["PASS", "FAIL"]) }),
  equity: z
    .strictObject({ equity_usd: z.number(), drawdown_pct: z.number().nonnegative(), as_of: z.number().int() })
    .nullish(),
  market: z.strictObject({
    liquidity_usd: z.number().nonnegative(),
    volatility_pct: z.number().nonnegative(),
    gas_usd: z.number().nonnegative(),
    reference_price: z.number().positive().optional(),
  }),
  config: z.strictObject({
    max_risk_pct_per_trade: z.number().nonnegative(),
    max_position_vs_pool_depth: z.number().nonnegative(),
    max_slippage_bps: z.number().nonnegative(),
    halt_new_entries_dd: z.number().nonnegative(),
    max_equity_age_sec: z.number().nonnegative(),
  }),
});
export type SizerInput = Omit<z.input<typeof sizerInputSchema>, keyof typeof handoff>;
