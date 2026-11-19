import { z } from "zod";
import { handoff } from "./common.js";

export const executorSchema = z.strictObject({
  ...handoff,
  decision: z.enum(["approve", "skip"]),
  reason: z.string(),
});
