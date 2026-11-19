import { z } from "zod";
import { chainSchema, handoff } from "./common.js";

export const reconASchema = z.strictObject({
  ...handoff,
  summary: z.string(),
  discovery_scope: z.strictObject({ chains: z.array(chainSchema), triggers: z.array(z.enum(["new_pair", "vol_spike", "liq_spike", "new_holder"])), pools_scanned: z.number().int().nonnegative() }).nullable(),
});
