import { z } from "zod";
import { handoff } from "./common.js";
import { reconChecksSchema } from "./recon-checks.js";

export const reconBInput = z.strictObject({ ...handoff, age_sec: z.number().nonnegative() });
const source = z.strictObject({ fetched_at: z.number().int(), ok: z.boolean() });
export const reconBSchema = z.strictObject({
  ...handoff,
  checks_raw: reconChecksSchema,
  provenance: z.strictObject({
    goplus: source,
    honeypot_is: source,
    rugcheck: source.extend({ applicable: z.boolean() }),
    etherscan: source,
  }),
  sources_disagree: z.boolean(),
  confidence: z.enum(["high", "medium", "low"]),
  reason: z.string(),
});
