import { z } from "zod";
import { assessment, handoff } from "./common.js";

export const rugCheckSchema = z.strictObject({
  ...handoff,
  assessment,
  reasons: z.array(z.string()),
});
