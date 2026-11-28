import { z } from "zod";
export const providerConfigSchema = z.strictObject({
  protocol:z.literal("openai-compatible").optional(),
  enabled: z.boolean().default(false),
  baseUrl: z.url({protocol:/^https?$/}),
  model: z.string().min(1),
  stageModels: z.record(z.string().min(1),z.string().min(1)).optional(),
  apiKeyEnv: z.string().regex(/^[A-Z][A-Z0-9_]*$/).optional(),
  thinking: z.enum(["enabled","disabled"]).optional(),
  timeoutMs: z.number().int().min(50).max(120_000).optional(),
  outputTokenField:z.enum(["max_tokens","max_completion_tokens"]).default("max_tokens"),
  capabilities: z.strictObject({
    structuredOutputs: z.boolean(),
    jsonMode: z.boolean().optional(),
    toolsWithJson: z.boolean().optional(),
    preserveReasoning: z.boolean().optional(),
    streamingText: z.boolean().optional(),
    streamingUsage: z.boolean().optional(),
    requiredToolChoice: z.boolean().optional(),
    tools: z.boolean(),
    maxContextTokens: z.number().int().positive(),
    costPerMTokIn: z.number().nonnegative(),
    costPerMTokOut: z.number().nonnegative(),
    cacheDiscount: z.number().min(0).max(1),
  }),
});
export const providerPolicySchema = z.strictObject({
  order: z.array(z.string()).default(["local","deepseek","grok","openai"]),
  mode: z.enum(["cost","latency","quality","round_robin"]).default("cost"),
  fallback_on: z.array(z.enum(["error","rate_limit","timeout","schema_mismatch"])).default(["error","rate_limit","timeout","schema_mismatch"]),
  healthCheckIntervalSec: z.number().int().positive().default(60),
});
export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type ProviderPolicy = z.infer<typeof providerPolicySchema>;
