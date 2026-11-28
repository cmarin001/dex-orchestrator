import { z } from "zod";

const basisPoints=z.number().int().min(0).max(4999);
export const paperCostsSchema=z.strictObject({
  version:z.literal(1),
  feeBps:basisPoints,
  slippageBps:basisPoints,
  fixedCents:z.number().int().nonnegative(),
});
export type PaperCosts=z.infer<typeof paperCostsSchema>;

export function paperEntry(costCents:number, mark:number, observedSlippageBps:number, costs:PaperCosts) {
  const fee=Math.ceil(costCents*costs.feeBps/10_000)+costs.fixedCents;
  const effectivePrice=costCents*mark*(1+Math.max(observedSlippageBps,costs.slippageBps)/10_000)/(costCents-fee);
  return fee>=costCents || !Number.isFinite(effectivePrice) || effectivePrice<=0 ? null : effectivePrice;
}

export function paperProceeds(costCents:number, entryPrice:number, mark:number, costs?:PaperCosts) {
  if (!costs) return Math.round(costCents*mark/entryPrice);
  const gross=costCents*(mark/entryPrice)*(1-costs.slippageBps/10_000);
  return Math.max(0,Math.floor(gross*(1-costs.feeBps/10_000)-costs.fixedCents));
}
