import { CandidateError } from "../orchestrator/errors.js";
import type { Handoff } from "../../schemas/common.js";
import { rugCheckSchema } from "../../schemas/rug-check.js";
import type { CallAgent } from "./call.js";

export const rugCheck = (call: CallAgent, identity: Handoff, data: unknown) =>
  call({ prompt: "rug-check", schema: rugCheckSchema, identity, data });

declare const clearRisk: unique symbol;
export type RugCheckPass = { assessment: "clear"; reasons: string[]; readonly [clearRisk]: true };
export function requireRugCheckPass(security: "clear" | "unknown" | "flagged",
  result: Awaited<ReturnType<typeof rugCheck>>): RugCheckPass {
  if (security !== "clear" || result.assessment !== "clear") throw new CandidateError("risk_not_clear");
  return result as unknown as RugCheckPass;
}
