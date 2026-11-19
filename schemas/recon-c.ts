import { z } from "zod";
import { handoff } from "./common.js";

export const reconCSchema = z.strictObject({
  ...handoff,
  sentiment: z.enum(["positive", "negative", "neutral", "unavailable"]),
  summary: z.string(),
});
