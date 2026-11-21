import { z } from "zod";
import { walletChainSchema } from "./transaction-intent.js";

export const signalSchema = z.strictObject({
  strategyId: z.string().min(1),
  token: z.string().min(1),
  chain: walletChainSchema,
  side: z.enum(["buy", "exit"]),
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1),
  proposed: z.strictObject({
    targetProfitBps: z.number().int().nonnegative(),
    stopLossBps: z.number().int().nonnegative(),
    timeoutSec: z.number().int().positive(),
  }),
});
export type Signal = z.infer<typeof signalSchema>;
