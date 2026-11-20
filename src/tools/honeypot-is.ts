import { z } from "zod";
import { normalizeAddress } from "../../schemas/common.js";
import type { Target } from "../../schemas/common.js";
import { getJson } from "./dexscreener.js";
import type { Fetch } from "./dexscreener.js";
import { evmChainIds } from "./goplus.js";
import type { Finding } from "./goplus.js";

const response = z.object({
  simulationSuccess: z.boolean(),
  honeypotResult: z.object({ isHoneypot: z.boolean() }).optional(),
  pair: z.object({ pair: z.object({ address: z.string() }) }).optional(),
  token: z.object({ address: z.string() }).optional(),
  chain: z.object({ id: z.string() }).optional(),
});

export async function honeypotIs({ chain, token, pair }: Target, request: Fetch = fetch): Promise<Finding> {
  if (chain === "solana") return { assessment: "unknown", reason: "Honeypot.is EVM only" };
  const url = new URL("https://api.honeypot.is/v2/IsHoneypot");
  url.search = new URLSearchParams({ address: token, pair, chainID: String(evmChainIds[chain]) }).toString();
  const parsed = response.safeParse(await getJson(url, request));
  if (parsed.success) {
    const data = parsed.data;
    if (data.honeypotResult?.isHoneypot) return { assessment: "flagged", reason: "Honeypot.is flagged token", checks_raw: { honeypot_sim_ok: false } };
    if (data.simulationSuccess && data.honeypotResult?.isHoneypot === false &&
        data.pair && normalizeAddress(chain, data.pair.pair.address) === pair &&
        data.token && normalizeAddress(chain, data.token.address) === token &&
        data.chain?.id === String(evmChainIds[chain])) {
      return { assessment: "clear", reason: "Honeypot.is simulation returned clear", checks_raw: { honeypot_sim_ok: true } };
    }
  }
  return { assessment: "unknown", reason: "No matching successful Honeypot.is simulation" };
}
