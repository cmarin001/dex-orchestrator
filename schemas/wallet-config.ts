import { z } from "zod";
import { positiveUnits, walletChainSchema } from "./transaction-intent.js";

export const walletConfigSchema = z.strictObject({
  mode: z.enum(["env", "kms"]),
  chain: walletChainSchema,
  daily_limit_cents: z.number().int().positive().safe(),
  per_trade_limit_cents: z.number().int().positive().safe(),
  max_fee_native: positiveUnits,
  mev_protection: z.boolean(),
  rpc_url: z.url({protocol: /^https?$/}),
  confirmations: z.number().int().positive().optional(),
});
export type WalletConfig = z.infer<typeof walletConfigSchema>;
