import { z } from "zod";
import { handoff, money } from "./common.js";

export const sizerSchema = z.strictObject({
  ...handoff,
  requested_cents: money,
  reason: z.string(),
});
