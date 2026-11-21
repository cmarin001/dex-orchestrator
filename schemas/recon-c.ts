import { z } from "zod";
import { chainSchema } from "./common.js";
export const reconCInput = z.strictObject({
  run_id: z.string(),
  chain: chainSchema,
  tokens: z.array(z.string()),
  window_minutes: z.number().positive(),
});
export const reconCSchema = z.array(
  z.strictObject({
    run_id: z.string(),
    chain: chainSchema,
    token: z.string(),
    mentions_1h: z.number().int().nonnegative(),
    unique_accounts: z.number().int().nonnegative(),
    sentiment: z.enum(["positive", "neutral", "negative"]),
    notable_mentions: z.number().int().nonnegative(),
    bot_heavy: z.boolean(),
    social_score: z.number().min(0).max(1).nullable(),
    sources: z.array(z.enum(["x", "reddit", "telegram"])),
    as_of: z.number().int(),
  }),
);
