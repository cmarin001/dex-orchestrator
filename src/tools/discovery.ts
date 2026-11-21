import { z } from "zod";
import { chainSchema, normalizeAddress, targetSchema } from "../../schemas/common.js";
import type { Chain, Target } from "../../schemas/common.js";
import { getJson } from "./dexscreener.js";
import type { Fetch } from "./dexscreener.js";

const network = { ethereum: "eth", polygon: "polygon_pos", arbitrum: "arbitrum", optimism: "optimism", bsc: "bsc", base: "base", solana: "solana" };
const discoveryTrigger = z.enum(["new_pair", "vol_spike", "liq_spike"]);
export const scopeSchema = z.strictObject({
  sources: z.array(z.strictObject({ chain: chainSchema, dex: z.string().regex(/^[a-z0-9_-]+$/), pages: z.number().int().min(1).max(3) })).max(8),
  triggers: z.array(discoveryTrigger).nonempty(),
  max_candidates: z.number().int().min(1).max(30),
});
export type DiscoveryScope = z.infer<typeof scopeSchema>;
type Statistics = { createdAt: number; volume: number; liquidity: number };
const pools = z.object({ data: z.array(z.object({
  attributes: z.object({ address: z.string(), pool_created_at: z.string(),
    reserve_in_usd: z.string().nullable(), volume_usd: z.object({ h1: z.string().nullable() }) }),
  relationships: z.object({ base_token: z.object({ data: z.object({ id: z.string() }) }) }),
})) });

export async function geckoterminalPoolsByDex(chain: Chain, dex: string, page: number, request: Fetch = fetch) {
  const id = network[chain];
  const url = new URL(`https://api.geckoterminal.com/api/v2/networks/${id}/dexes/${encodeURIComponent(dex)}/pools?page=${page}`);
  const payload = pools.parse(await getJson(url, request, { Accept: "application/json;version=20230203" }));
  return payload.data.flatMap(({ attributes, relationships }) => {
    const base = relationships.base_token.data.id;
    const result = targetSchema.safeParse({ chain, pair: normalizeAddress(chain, attributes.address),
      token: base.startsWith(id + "_") ? normalizeAddress(chain, base.slice(id.length + 1)) : "" });
    return result.success ? [{ target: result.data, statistics: { createdAt: Date.parse(attributes.pool_created_at),
      liquidity: Number(attributes.reserve_in_usd ?? NaN), volume: Number(attributes.volume_usd.h1 ?? NaN) } }] : [];
  });
}

function spike(value: number, previous: number | undefined, ratio: number) {
  return Number.isFinite(value) && previous !== undefined && Number.isFinite(previous) && previous > 0 && value >= previous * ratio;
}

export async function discover(scope: DiscoveryScope, request: Fetch = fetch,
  prior: ReadonlyMap<string, Statistics> = new Map(), now = Date.now()) {
  const candidates = new Map<string, Target & { trigger: z.infer<typeof discoveryTrigger> }>();
  const statistics = new Map<string, Statistics>();
  const counts: Partial<Record<Chain, number>> = {};
  for (const source of scope.sources) {
    for (let page = 1; page <= source.pages; page += 1) {
      const entries = await geckoterminalPoolsByDex(source.chain, source.dex, page, request);
      counts[source.chain] = (counts[source.chain] ?? 0) + entries.length;
      for (const { target, statistics: current } of entries) {
        const pool = target.chain + ":" + target.pair;
        const key = target.chain + ":" + target.token;
        const last = prior.get(pool);
        statistics.set(pool, current);
        const age = now - current.createdAt;
        const trigger = scope.triggers.find(mode =>
          mode === "new_pair" ? age >= 0 && age <= 86_400_000 :
          mode === "vol_spike" ? spike(current.volume, last?.volume, 2) :
          spike(current.liquidity, last?.liquidity, 1.5));
        if (trigger && !candidates.has(key) && candidates.size < scope.max_candidates) candidates.set(key, { ...target, trigger });
      }
    }
  }
  return { targets: [...candidates.values()], counts, scope, statistics };
}
