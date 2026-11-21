import { z } from "zod";
import { chainSchema } from "./common.js";

export const walletChainSchema = z.union([chainSchema, z.literal("bitcoin")]);
const units = z.string().regex(/^(0|[1-9][0-9]{0,77})$/);
export const positiveUnits = units.refine(value => value !== "0");
export const routeHintSchema = z.enum(["0x", "jupiter", "native"]);
export const transactionIntentSchema = z.strictObject({
  run_id: z.string().min(1).max(200),
  chain: walletChainSchema,
  token_in: z.string().min(1),
  token_out: z.string().min(1),
  amount_in: positiveUnits,
  min_amount_out: positiveUnits,
  max_fee_native: positiveUnits,
  deadline_sec: z.number().int().positive(),
  size_cents: z.number().int().positive().safe(),
  route: routeHintSchema,
});
export type TransactionIntent = z.infer<typeof transactionIntentSchema>;
export type WalletChain = z.infer<typeof walletChainSchema>;
