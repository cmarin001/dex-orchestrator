import { isDeepStrictEqual } from "node:util";
import { securityEvidence } from "../tools/recon-evidence.js";
import type { Handoff } from "../../schemas/common.js";
import { reconBInput, reconBSchema } from "../../schemas/recon-b.js";
import type { Fetch } from "../tools/dexscreener.js";
import { evmChainIds } from "../tools/goplus.js";
import { reconAction } from "../tools/recon-action.js";
import { matchesIdentity, type CallAgent } from "./call.js";

export async function reconB(
  call: CallAgent,
  identity: Handoff,
  age_sec: number,
  request: Fetch = fetch,
  goPlusKey?: string,
  etherscanKey?: string,
) {
  const { chain, token } = identity;
  const sol = chain === "solana";
  const chain_id = sol ? "sol" : evmChainIds[chain];
  const slug = sol ? "solana/token_security" : "token_security/" + chain_id;
  const actions = [
    reconAction(
      "goplus_token_security",
      { chain_id, address: token },
      new URL("https://api.gopluslabs.io/api/v1/" + slug + "?contract_addresses=" + encodeURIComponent(token)),
      request,
      goPlusKey ? { Authorization: "Bearer " + goPlusKey } : undefined,
    ),
    reconAction(
      "honeypot_is",
      { address: token, chain_id },
      new URL(
        "https://api.honeypot.is/v2/IsHoneypot?" +
          new URLSearchParams({ address: token, pair: identity.pair, chainID: String(chain_id) }),
      ),
      request,
    ),
  ];
  if (sol)
    actions.push(
      reconAction(
        "rugcheck_xyz_report",
        { mint: token },
        new URL("https://api.rugcheck.xyz/v1/tokens/" + encodeURIComponent(token) + "/report"),
        request,
      ),
    );
  if (!sol && etherscanKey)
    actions.push(
      reconAction(
        "etherscan_token_info",
        { chain, address: token },
        new URL(
          "https://api.etherscan.io/v2/api?" +
            new URLSearchParams({
              chainid: String(chain_id),
              module: "contract",
              action: "getcontractcreation",
              contractaddresses: token,
              apikey: etherscanKey,
            }),
        ),
        request,
      ),
    );
  const names = ["goplus", "honeypot_is", sol ? "rugcheck" : "etherscan"] as const;
  return call({
    prompt: "recon-b-onchain",
    schema: reconBSchema,
    identity,
    data: reconBInput.parse({ ...identity, age_sec }),
    tools: actions.map((a) => a.tool),
    validate: (output) => {
      const evidence = securityEvidence(
        identity,
        actions[0]?.observation()?.data,
        actions[1]?.observation()?.data,
        sol ? actions[2]?.observation()?.data : null,
      );
      const unavailable =
        (!sol && output.provenance.rugcheck.ok) || ((!etherscanKey || sol) && output.provenance.etherscan.ok);
      return (
        !unavailable &&
        output.confidence === evidence.confidence &&
        isDeepStrictEqual(output.checks_raw, evidence.raw) &&
        output.sources_disagree === evidence.conflict &&
        matchesIdentity(output, identity) &&
        output.provenance.rugcheck.applicable === sol &&
        actions.every((a, i) => {
          const seen = a.observation();
          const origin = output.provenance[names[i]!];
          return seen !== undefined && origin.fetched_at === seen.fetched_at && (!origin.ok || seen.ok);
        }) &&
        (!output.sources_disagree || output.confidence === "low") &&
        (actions.some((a) => a.observation()?.ok) || Object.values(output.checks_raw).every((value) => value === null))
      );
    },
  });
}
