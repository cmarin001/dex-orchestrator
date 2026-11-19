import { z } from "zod";
import { identityFields } from "./common.js";
import { exitPolicySchema } from "./exit-policy.js";

export const chartPointSchema = z.strictObject({
  t: z.number().int().nonnegative(), price: z.number().positive(),
  source: z.enum(["dexscreener", "geckoterminal", "aggregated"]),
});
export const positionMarkSchema = z.strictObject({
  side: z.enum(["buy", "sell"]), price: z.number().positive(), size_usd: z.number().nonnegative(),
  at: z.number().int().nonnegative(), tx_hash: z.string().nullable(),
});
export const liveViewSchema = z.strictObject({
  ...identityFields, entry_price: z.number().positive(), entry_at: z.number().int().nonnegative(),
  policy: exitPolicySchema, marks: z.array(positionMarkSchema), series: z.array(chartPointSchema),
  active_target_bps: z.number().int(), target_price: z.number().positive(),
  target_series: z.array(z.strictObject({ t: z.number().int(), price: z.number().positive() })), current_mark: chartPointSchema.nullable(), as_of: z.number().int(),
});
export type ChartPoint = z.infer<typeof chartPointSchema>;
export type PositionMark = z.infer<typeof positionMarkSchema>;
export type LiveView = z.infer<typeof liveViewSchema>;
export type Provenanced<T> = { value: T; source: ChartPoint["source"]; observed_at: number };
