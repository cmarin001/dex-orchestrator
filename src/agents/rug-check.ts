import type { Handoff } from "../../schemas/common.js";
import { rugCheckSchema } from "../../schemas/rug-check.js";
import type { CallAgent } from "./call.js";

export const rugCheck = (call: CallAgent, identity: Handoff, data: unknown) =>
  call({ prompt: "rug-check", schema: rugCheckSchema, identity, data });
