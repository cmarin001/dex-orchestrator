import { z } from "zod";
import type { Target } from "../../schemas/common.js";

export const marketMarkSchema=z.strictObject({
  price_usd:z.number().positive(),
  source:z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/),
  vol_24h_usd:z.number().nonnegative().optional(),
  market_cap_usd:z.number().nonnegative().optional(),
});
export type MarketMark=z.infer<typeof marketMarkSchema>;

export interface MarketMarkProvider {
  mark(target:Target, signal?:AbortSignal):Promise<MarketMark>;
}
