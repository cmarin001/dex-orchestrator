import { z } from "zod";
import { consensusSchema } from "./strategy.js";

export const operatingMode = z.enum(["ai", "strategies", "human", "hybrid"]);
export const degradationMode = z.enum(["strategies", "human", "pause"]);
export const modeConfigSchema = z.strictObject({
  mode: operatingMode.default("strategies"),
  strategyConsensus: consensusSchema.default("majority"),
  strategyWeights:z.record(z.string(),z.number().nonnegative()).default({}),
  strategyMinConfidence:z.number().min(0).max(1).default(.5),
  aiAdvisory: z.boolean().default(false),
  aiAdvisoryOn: z.array(z.enum(["ambiguous_rug","signal_disagreement","novel_token"])).default([]),
  humanApprovalRequired: z.boolean().default(false),
  humanApprovalTimeoutSec: z.number().int().positive().max(120).default(120),
  onAllProvidersDown: degradationMode.default("strategies"),
  onBudgetExhausted: degradationMode.default("strategies"),
});
export type ModeConfig = z.infer<typeof modeConfigSchema>;
