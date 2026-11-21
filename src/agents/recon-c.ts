import type { Handoff } from "../../schemas/common.js";
import { reconCSchema } from "../../schemas/recon-c.js";
import type { CallAgent } from "./call.js";

export const reconC = (call: CallAgent, identity: Handoff, observations: readonly string[] = []) =>
  call({ prompt: "recon-c-social", promptFile: "runtime/recon-c-social", schema: reconCSchema, identity, data: { identity, data: { observations } } });
