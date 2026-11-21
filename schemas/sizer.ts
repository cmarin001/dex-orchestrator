import { z } from "zod";
import { handoff } from "./common.js";

export const sizerSchema = z.strictObject({
  ...handoff,
  status: z.enum(["SIZED", "REFUSED", "HALTED"]),
  size_usd: z.number().nonnegative(),
  size_tokens: z.number().nonnegative().nullable(),
  max_slippage_bps: z.number().int().nonnegative(),
  equity_at_decision: z.number().nonnegative(),
  equity_age_sec: z.number().nonnegative(),
  risk_pct_used: z.number().min(0).max(1),
  reason: z.string(),
});

export type SizerInput = {
  rug: { verdict: "PASS" | "FAIL" };
  equity: { equity_usd: number; drawdown_pct: number; as_of: number } | null;
  market: { liquidity_usd: number; volatility_pct: number; gas_usd: number; reference_price?: number };
  config: {
    max_risk_pct_per_trade: number; max_position_vs_pool_depth: number;
    max_slippage_bps: number; halt_new_entries_dd: number; max_equity_age_sec: number;
  };
  now: number;
};
