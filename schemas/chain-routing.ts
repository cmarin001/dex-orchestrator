import { z } from "zod";
import { walletChainSchema } from "./transaction-intent.js";

export const memecoinFilterSchema = z.strictObject({
  maxAgeSec: z.number().positive(),
  minLiquidityUsd: z.number().nonnegative(),
  maxLiquidityUsd: z.number().positive(),
  minHolders: z.number().nonnegative(),
  maxTop10Pct: z.number().min(0).max(100),
  knownLaunchpads: z.array(z.string()).optional(),
}).refine(i => i.minLiquidityUsd <= i.maxLiquidityUsd);

export const chainRoutingSchema = z.strictObject({
  mode: z.enum(["fixed", "ai-decided", "strategy-scored", "human", "all"]).default("fixed"),
  enabledChains: z.array(walletChainSchema).min(1).default(["base"]),
  perChainCapitalPct: z.partialRecord(walletChainSchema, z.number().min(0).max(1)).default({base:1}),
  assetClasses: z.partialRecord(walletChainSchema,z.array(z.enum(["memecoin","utility"]))).default({base:["memecoin"]}),
  memecoinFilters: z.partialRecord(walletChainSchema,memecoinFilterSchema).default({
    base:{maxAgeSec:86400,minLiquidityUsd:15000,maxLiquidityUsd:500000,minHolders:0,maxTop10Pct:40},
  }),
}).superRefine((value, ctx) => {
  if (Object.values(value.perChainCapitalPct).reduce((sum, percent) => sum + percent, 0) > 1 + Number.EPSILON ||
      new Set(value.enabledChains).size !== value.enabledChains.length ||
      value.enabledChains.some(chain => chain === "bitcoin" ||
        !value.memecoinFilters[chain] || !value.assetClasses[chain]?.length ||
        (value.mode !== "all" && value.perChainCapitalPct[chain] === undefined)) ||
      Object.entries(value.perChainCapitalPct).some(([chain,pct])=>pct>0 &&
        !value.enabledChains.some(enabled=>enabled===chain))) {
    ctx.addIssue({code:"custom",message:"Invalid chain allocation or discovery scope"});
  }
});
export type ChainRouting = z.infer<typeof chainRoutingSchema>;
