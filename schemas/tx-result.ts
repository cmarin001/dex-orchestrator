import { z } from "zod";
import { positiveUnits, walletChainSchema } from "./transaction-intent.js";

export const simulationResultSchema = z.strictObject({
  ok: z.boolean(),
  max_fee_native: positiveUnits,
});
export const txReceiptSchema = z.strictObject({
  chain: walletChainSchema,
  tx_hash: z.string().min(1),
  status: z.enum(["pending", "confirmed", "failed", "replaced"]),
  amount_out: positiveUnits.optional(),
  amount_in: positiveUnits.optional(),
  fee_native: z.string().regex(/^\d+$/).optional(),
});
export type TxReceipt = z.infer<typeof txReceiptSchema>;
export type SimulationResult = z.infer<typeof simulationResultSchema>;

export const txResultSchema = z.strictObject({
  simulation: simulationResultSchema,
  receipt: txReceiptSchema,
});
export type TxResult = z.infer<typeof txResultSchema>;
