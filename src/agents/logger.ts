import type { Handoff } from "../../schemas/common.js";
import { loggerSchema } from "../../schemas/logger.js";
import type { CallAgent } from "./call.js";

export const logger = (call: CallAgent, identity: Handoff, data: unknown) =>
  call({ prompt: "logger", schema: loggerSchema, identity, data });
