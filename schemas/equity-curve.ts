import { z } from "zod";

export const equityCurveSchema = z.strictObject({
  equity_usd: z.number(),
  drawdown_pct: z.number().nonnegative(),
  win_rate: z.number().min(0).max(1),
  expectancy_usd: z.number(),
  trades_closed: z.number().int().nonnegative(),
  as_of: z.number().int().nonnegative(),
});
export type EquityCurveInput = {
  starting_equity_usd: number;
  closed_trades: Array<{
    run_id: string;
    token: string;
    pnl_usd: number;
    slippage_bps: number;
    hold_sec: number;
    closed_at: number;
  }>;
  as_of: number;
};

export const equityCurveInputSchema = z.strictObject({
  starting_equity_usd: z.number().nonnegative(),
  closed_trades: z.array(
    z.strictObject({
      run_id: z.string(),
      token: z.string(),
      pnl_usd: z.number(),
      slippage_bps: z.number(),
      hold_sec: z.number().nonnegative(),
      closed_at: z.number().int(),
    }),
  ),
  as_of: z.number().int(),
});
