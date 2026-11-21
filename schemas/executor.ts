import { z } from "zod";
import { handoff } from "./common.js";

export const executorSchema = z.strictObject({
  ...handoff,
  action: z.enum(["entry", "exit"]),
  status: z.enum(["FILLED", "ABORTED", "PARTIAL", "SKIPPED"]),
  fill_price: z.number().positive().nullable(),
  size_usd: z.number().nonnegative().nullable(),
  gas_usd: z.number().nonnegative().nullable(),
  slippage_bps: z.number().nonnegative().nullable(),
  tx_hash: z.string(),
  reason: z.string(),
});
export type ExecutorInput = {
  sizer: Pick<z.infer<typeof import("./sizer.js").sizerSchema>, "status" | "size_usd" | "max_slippage_bps">;
  action: "entry" | "exit";
  position: {
    stop_loss_bps: number;
    take_profit_bps: number;
    max_hold_sec: number;
    entry_price: number;
    opened_at: number;
  } | null;
  market: { quote_price: number; expected_slippage_bps: number; gas_usd: number; now: number };
};

export const executorInput = z.strictObject({
  ...handoff,
  sizer: z.strictObject({
    status: z.enum(["SIZED", "REFUSED", "HALTED"]),
    size_usd: z.number(),
    max_slippage_bps: z.number(),
  }),
  action: z.enum(["entry", "exit"]),
  position: z
    .strictObject({
      stop_loss_bps: z.number(),
      take_profit_bps: z.number(),
      max_hold_sec: z.number(),
      entry_price: z.number().positive(),
      opened_at: z.number(),
    })
    .nullable(),
  market: z.strictObject({
    quote_price: z.number().positive(),
    expected_slippage_bps: z.number(),
    gas_usd: z.number(),
    now: z.number(),
  }),
});
