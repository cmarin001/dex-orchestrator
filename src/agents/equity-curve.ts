import type { Handoff } from "../../schemas/common.js";
import { equityCurveSchema } from "../../schemas/equity-curve.js";
import type { EquityCurveInput } from "../../schemas/equity-curve.js";
import type { CallAgent } from "./call.js";

export const equityCurve = (call: CallAgent, identity: Handoff, data: EquityCurveInput) =>
  call({
    prompt: "equity-curve", schema: equityCurveSchema, identity, data,
    validate: output => output.as_of === data.as_of && output.trades_closed === data.closed_trades.length,
  });
