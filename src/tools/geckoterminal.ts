import { z } from "zod";
import { normalizeAddress } from "../../schemas/common.js";
import type { Target } from "../../schemas/common.js";
import { CandidateError } from "../orchestrator/errors.js";
import { getJson } from "./dexscreener.js";
import type { Fetch } from "./dexscreener.js";

const networks = { ethereum: "eth", bsc: "bsc", base: "base", solana: "solana" };
const response = z.object({
  data: z.object({
    attributes: z.object({ address: z.string(), reserve_in_usd: z.string() }),
    relationships: z.object({ base_token: z.object({ data: z.object({ id: z.string() }) }) }),
  }),
});

export async function geckoTerminal(target: Target, request: Fetch = fetch) {
  const { chain, pair, token } = target;
  const network = networks[chain];
  const url = new URL(`https://api.geckoterminal.com/api/v2/networks/${network}/pools/${encodeURIComponent(pair)}`);
  const payload = response.safeParse(await getJson(url, request, { Accept: "application/json;version=20230203" }));
  if (payload.success) {
    const { attributes, relationships } = payload.data.data;
    const reserve = Number(attributes.reserve_in_usd);
    if (normalizeAddress(chain, attributes.address) === pair &&
        normalizeAddress(chain, relationships.base_token.data.id) === `${network}_${token}` &&
        attributes.reserve_in_usd.trim() && Number.isFinite(reserve) && reserve >= 0) {
      return { liquidity_usd: reserve };
    }
  }
  throw new CandidateError("GeckoTerminal returned no matching pool");
}
