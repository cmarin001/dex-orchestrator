import type { z } from "zod";
import type { Handoff } from "../../schemas/common.js";
import { reconASchema } from "../../schemas/recon-a.js";
import type { MarketSnapshot } from "../../schemas/recon-snapshot.js";
import type { Timed } from "../cache/ttl.js";
import { CandidateError } from "../orchestrator/errors.js";
import { dexScreener } from "../tools/dexscreener.js";
import type { Fetch } from "../tools/dexscreener.js";
import { geckoTerminal } from "../tools/geckoterminal.js";
import type { CallAgent } from "./call.js";

export async function reconA(call: CallAgent, identity: Handoff, request?: Fetch,
  discovery_scope: z.infer<typeof reconASchema>["discovery_scope"] = null,
  trigger: MarketSnapshot["trigger"] = "new_pair"): Promise<MarketSnapshot> {
  let dex: Timed<Awaited<ReturnType<typeof dexScreener>>> | undefined;
  let gecko: Timed<Awaited<ReturnType<typeof geckoTerminal>>> | undefined;
  await call({
    prompt: "recon-a-market-intel", promptFile: "runtime/recon-a-market-intel", schema: reconASchema, identity, data: { identity, data: { discovery_scope } },
    tools: [
      { name: "dexscreener", description: "Fetch price and liquidity for the configured pair.", run: async () => {
        const observedAt = Date.now();
        dex = { value: await dexScreener(identity, request), observedAt };
        return dex.value;
      } },
      { name: "geckoterminal", description: "Fetch liquidity for the configured pool.", run: async () => {
        const observedAt = Date.now();
        gecko = { value: await geckoTerminal(identity, request), observedAt };
        return gecko.value;
      } },
    ],
  });
  if (!dex || !gecko) throw new CandidateError("Market evidence missing");
  const { price_usd, liquidity_usd, vol_1h_usd, created_at_ms } = dex.value;
  if (vol_1h_usd === undefined || created_at_ms === undefined || created_at_ms > dex.observedAt) {
    throw new CandidateError("Market volume or pool age missing");
  }
  const dexFetchedAt = dex.observedAt;
  const observed = (value: number) => ({ value, source: "dexscreener", fetched_at: dexFetchedAt });
  const fetched_at = Math.min(dex.observedAt, gecko.observedAt);
  return {
    source_fetched_at: fetched_at, trigger, price_usd: observed(price_usd),
    liquidity_usd: { value: Math.min(liquidity_usd, gecko.value.liquidity_usd), source: "dexscreener+geckoterminal", fetched_at },
    vol_1h_usd: observed(vol_1h_usd), age_sec: observed(Math.floor((dex.observedAt - created_at_ms) / 1000)),
  };
}
