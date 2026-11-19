import { z } from "zod";
import { handoff } from "./common.js";

export const scannerSchema = z.strictObject({
  ...handoff,
  decision: z.enum(["advance", "skip"]),
  reason: z.string(),
});
