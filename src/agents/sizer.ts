import type { Handoff } from "../../schemas/common.js";
import { sizerSchema } from "../../schemas/sizer.js";
import type { CallAgent } from "./call.js";

export const sizer = (call: CallAgent, identity: Handoff, data: unknown) =>
  call({ prompt: "sizer", schema: sizerSchema, identity, data });
