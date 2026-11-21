import { z } from "zod";
import { chainSchema, handoff } from "./common.js";
import { scannerFeedFields } from "./scanner.js";
export const reconAInput = z.strictObject({
  run_id: z.string(),
  chain: chainSchema,
  modes: z.array(z.enum(["new_pairs", "vol_spike", "liq_spike"])),
  seen: z.array(z.string()),
  config: z.strictObject({
    min_liquidity_usd: z.number(),
    min_age_sec: z.number(),
    min_vol_1h_usd: z.number(),
    max_age_sec: z.number(),
  }),
});
export const reconAMarketRow = z.strictObject({
  ...handoff,
  ...scannerFeedFields,
  discovered_at: z.number().int(),
  source: z.enum(["dexscreener", "geckoterminal"]),
  source_fetched_at: z.number().int(),
  skipped: z.boolean(),
  reason: z.string(),
});
export const reconASchema = z.array(
  z.union([reconAMarketRow, z.strictObject({ status: z.literal("ERROR"), source: z.string(), reason: z.string() })]),
);
