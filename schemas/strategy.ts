import { z } from "zod";

export const consensusSchema = z.enum(["single", "majority", "weighted", "all"]);
export const aggregatorSchema = z.strictObject({
  mode: consensusSchema,
  minConfidence: z.number().min(0).max(1).default(.5),
  weights: z.record(z.string(), z.number().nonnegative()).optional(),
  overlays: z.array(z.string()).default([]),
});
export const strategySetting = z.strictObject({
  enabled: z.boolean(),
  params: z.record(z.string(), z.unknown()),
});
