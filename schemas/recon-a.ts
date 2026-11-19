import { z } from "zod";
import { handoff } from "./common.js";

export const reconASchema = z.strictObject({
  ...handoff,
  summary: z.string(),
});
