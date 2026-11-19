import type { Handoff } from "../../schemas/common.js";
import { scannerSchema } from "../../schemas/scanner.js";
import type { CallAgent } from "./call.js";

export const scanner = (call: CallAgent, identity: Handoff, data: unknown) =>
  call({ prompt: "scanner", schema: scannerSchema, identity, data });
