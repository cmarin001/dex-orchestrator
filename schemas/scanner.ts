import { z } from "zod";
import { handoff } from "./common.js";

export const scannerFeedFields = {
  trigger: z.enum(["new_pair", "vol_spike", "liq_spike"]),
  liquidity_usd: z.number().nonnegative(),
  vol_1h_usd: z.number().nonnegative(),
  age_sec: z.number().nonnegative(),
};
export const scannerRowSchema = z.strictObject({
  ...handoff,
  ...scannerFeedFields,
  discovered_at: z.number().int().nonnegative(),
  rank_score: z.number().int().nonnegative(),
  reason: z.string(),
  skipped: z.boolean(),
});
export const scannerSchema = z.array(scannerRowSchema);
export type ScannerRow = z.infer<typeof scannerRowSchema>;
export const scannerInputSchema = z.strictObject({
  run_id: z.string(),
  feed: z.array(z.strictObject({ chain: handoff.chain, pair: z.string(), token: z.string(), ...scannerFeedFields })),
  config: z.strictObject({
    min_liquidity_usd: z.number().nonnegative(),
    min_age_sec: z.number().nonnegative(),
    min_vol_1h_usd: z.number().nonnegative(),
    top_n: z.number().int().nonnegative().default(20),
    dedup_window_sec: z.number().nonnegative().default(3600),
  }),
  seen: z.array(z.string()),
});
export type ScannerInput = z.input<typeof scannerInputSchema>;
