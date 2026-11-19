import { z } from "zod";
import { handoff } from "./common.js";

export const exitReasonSchema = z.enum(["target", "timeout", "manual", "stop"]);
export const paperCloseSchema = z.strictObject({
  exit_at: z.number().int(), exit_price: z.number().positive(),
  exit_reason: exitReasonSchema, proceeds_cents: z.number().int().nonnegative(),
});
export const tradeHistorySchema = z.strictObject({
  ...handoff, entry_at: z.number().int(), exit_at: z.number().int(), hold_sec: z.number().nonnegative(),
  entry_price: z.number().positive(), exit_price: z.number().positive(), size_usd: z.number().positive(),
  pnl_usd: z.number(), pnl_pct: z.number(), exit_reason: exitReasonSchema,
  tx_entry: z.string().nullable(), tx_exit: z.string().nullable(),
});
export type TradeHistoryRow = z.infer<typeof tradeHistorySchema>;
export type PaperClose = z.infer<typeof paperCloseSchema>;
