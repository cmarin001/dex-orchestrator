import { z } from "zod";
import { assessment, handoff } from "./common.js";

export const reconBSchema = z.strictObject({
  ...handoff,
  assessment,
  reasons: z.array(z.string()),
});
