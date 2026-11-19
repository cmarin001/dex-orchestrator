import { z } from "zod";
import { handoff } from "./common.js";

export const equityCurveSchema = z.strictObject({
  ...handoff,
  commentary: z.string(),
});
