import { z } from "zod";
import { handoff } from "./common.js";

export const scannerFeedFields = {
  trigger: z.enum(["new_pair", "vol_spike", "liq_spike"]),
  liquidity_usd: z.number().nonnegative(),
  vol_1h_usd: z.number().nonnegative(),
  age_sec: z.number().nonnegative(),
};
export const scannerRowSchema = z.strictObject({
  ...handoff, ...scannerFeedFields,
  discovered_at: z.number().int().nonnegative(),
  rank_score: z.number().int().nonnegative(),
  reason: z.string(),
  skipped: z.boolean(),
});
export const scannerSchema = z.array(scannerRowSchema);
export type ScannerRow = z.infer<typeof scannerRowSchema>;
export type ScannerInput = {
  run_id: string;
  feed: Array<Pick<ScannerRow, "chain" | "token" | "pair" | keyof typeof scannerFeedFields> &
    { social_score?: number | null; as_of?: number }>;
  config: {
    min_liquidity_usd: number;
    min_age_sec: number;
    min_vol_1h_usd: number;
    top_n: number;
    dedup_window_sec: number;
  };
  seen: string[];
  now: number;
};
