import type { Handoff } from "../../schemas/common.js";
import { reconBSchema } from "../../schemas/recon-b.js";
import type { Timed } from "../cache/ttl.js";
import { CandidateError } from "../orchestrator/errors.js";
import type { Fetch } from "../tools/dexscreener.js";
import { goPlus } from "../tools/goplus.js";
import type { Finding } from "../tools/goplus.js";
import { honeypotIs } from "../tools/honeypot-is.js";
import { rugCheckXyz } from "../tools/rugcheck-xyz.js";
import type { CallAgent, Tool } from "./call.js";

export async function reconB(call: CallAgent, identity: Handoff, request?: Fetch, token?: string) {
  const readings: Timed<Finding>[] = [];
  function tool(name: string, description: string, read: () => Promise<Finding>): Tool {
    return { name, description, run: async () => {
      const observedAt = Date.now();
      const value = await read();
      readings.push({ value, observedAt });
      return value;
    } };
  }
  const secondary = identity.chain === "solana"
    ? tool("rugcheck_xyz", "Fetch the Solana mint risk summary.", () => rugCheckXyz(identity, request))
    : tool("honeypot_is", "Fetch the EVM pair sell-simulation report.", () => honeypotIs(identity, request));
  const model = await call({
    prompt: "recon-b-onchain", promptFile: "runtime/recon-b-onchain", schema: reconBSchema, identity, data: { identity, data: {} },
    tools: [tool("goplus", "Fetch GoPlus security flags.", () => goPlus(identity, request, token)), secondary],
  });
  if (readings.length !== 2) throw new CandidateError("Required security evidence missing");
  const findings = [...readings.map(({ value }) => value.assessment), model.assessment];
  const assessment = findings.includes("flagged") ? "flagged" : findings.includes("unknown") ? "unknown" : "clear";
  return {
    value: { assessment, checks_raw: Object.assign({}, ...readings.map(({ value }) => value.checks_raw)), reasons: [...readings.map(({ value }) => value.reason), ...model.reasons] } satisfies
      { assessment: Finding["assessment"]; reasons: string[]; checks_raw: NonNullable<Finding["checks_raw"]> },
    observedAt: Math.min(...readings.map(({ observedAt }) => observedAt)),
  };
}
