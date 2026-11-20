import { isDeepStrictEqual } from "node:util";
import type { Handoff } from "../../schemas/common.js";
import { loggerSchema } from "../../schemas/logger.js";
import type { LogHop } from "../../schemas/logger.js";
import type { CallAgent } from "./call.js";

export const logger = (call: CallAgent, identity: Handoff, hops: readonly LogHop[]) =>
  call({
    prompt: "logger", schema: loggerSchema, identity,
    data: hops.map(hop => ({ ...identity, hop })),
    validate: output => output.logged === hops.length && output.rows.length === hops.length &&
      output.rows.every((row, i) => row.run_id === identity.run_id && row.token === identity.token &&
        row.agent === hops[i]?.agent && isDeepStrictEqual(row.output, hops[i]?.output) &&
        (!("malformed" in row) || row.gaps.includes("*"))),
  });
