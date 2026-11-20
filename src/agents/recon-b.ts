import type { Handoff } from "../../schemas/common.js";
import { reconBSchema } from "../../schemas/recon-b.js";
import type { Timed } from "../cache/ttl.js";
import type { SecuritySnapshot } from "../../schemas/recon-snapshot.js";
import type { RugChecksRaw } from "../../schemas/rug-check.js";
import { failureKind, log } from "../logging/operational.js";
import type { Fetch } from "../tools/dexscreener.js";
import { goPlus } from "../tools/goplus.js";
import type { Finding } from "../tools/goplus.js";
import { honeypotIs } from "../tools/honeypot-is.js";
import { rugCheckXyz } from "../tools/rugcheck-xyz.js";
import type { CallAgent, Tool } from "./call.js";

const requiredChecks = new Set<keyof RugChecksRaw>(["renounced", "mint_auth_disabled",
  "freeze_auth_disabled", "lp_locked_or_burned", "honeypot_sim_ok"]);

export async function reconB(call: CallAgent, identity: Handoff, request?: Fetch, token?: string): Promise<SecuritySnapshot & { reasons: string[] }> {
  const readings = new Map<string, Timed<Finding>>();
  function tool(name: string, description: string, read: () => Promise<Finding>): Tool {
    return { name, description, run: async () => {
      const observedAt = Date.now();
      const value = await read().catch((error: unknown): Finding => {
        log("warn", "recon.security_source_failed", { provider: name, failure_kind: failureKind(error) });
        return { assessment: "unknown", reason: name + " unavailable" };
      });
      readings.set(name, { value, observedAt });
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
  const checks_raw: RugChecksRaw = {};
  const provenance: SecuritySnapshot["provenance"] = {};
  const required = ["goplus", secondary.name];
  let sources_disagree = false;
  for (const source of required) {
    const reading = readings.get(source);
    const fetched_at = reading?.observedAt ?? Date.now();
    provenance[source] = { source, fetched_at, ok: !!reading && reading.value.assessment !== "unknown" };
    for (const [key, value] of Object.entries(reading?.value.checks_raw ?? {})) {
      if (value == null) continue;
      const field = key as keyof RugChecksRaw;
      const previous = checks_raw[field];
      const critical = requiredChecks.has(field);
      if (critical && previous != null && previous !== value) sources_disagree = true;
      const largerIsRiskier = field === "blacklist_present" || field === "deployer_rugged_before";
      if (previous != null && !(typeof value === "boolean"
        ? value === largerIsRiskier : typeof previous === "number" && value > previous)) continue;
      Object.assign(checks_raw, { [field]: value });
      provenance[field] = { source, fetched_at, ok: true };
    }
  }
  const observations = [...readings.values()];
  const findings = observations.map(({ value }) => value.assessment);
  const assessment = findings.includes("flagged") || model.assessment === "flagged" ? "flagged"
    : required.some(source => !provenance[source]?.ok) || model.assessment === "unknown" ? "unknown" : "clear";
  return { assessment, checks_raw, provenance, sources_disagree,
    source_fetched_at: Math.min(...required.map(source => provenance[source]!.fetched_at)),
    reasons: [...observations.map(({ value }) => value.reason), ...model.reasons] };
}
