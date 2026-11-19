import type { Handoff } from "../../schemas/common.js";
import { equityCurveSchema } from "../../schemas/equity-curve.js";
import type { CallAgent } from "./call.js";

export const equityCurve = (call: CallAgent, identity: Handoff, data: unknown) =>
  call({ prompt: "equity-curve", schema: equityCurveSchema, identity, data });
