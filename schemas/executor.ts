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
  position: { stop_loss_bps: number; take_profit_bps: number; max_hold_sec: number; entry_price: number; opened_at: number } | null;
  market: { quote_price: number; expected_slippage_bps: number; gas_usd: number; now: number };
};
