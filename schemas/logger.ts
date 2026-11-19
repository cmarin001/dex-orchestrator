import { z } from "zod";
import { handoff } from "./common.js";

export const loggerSchema = z.strictObject({
  ...handoff,
  summary: z.string(),
  gaps: z.array(z.string()),
});
