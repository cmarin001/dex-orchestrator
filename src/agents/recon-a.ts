import type { z } from "zod";
import type { Handoff } from "../../schemas/common.js";
import { reconASchema } from "../../schemas/recon-a.js";
import type { Timed } from "../cache/ttl.js";
import { CandidateError } from "../orchestrator/errors.js";
import { dexScreener } from "../tools/dexscreener.js";
import type { Fetch } from "../tools/dexscreener.js";
import { geckoTerminal } from "../tools/geckoterminal.js";
import type { CallAgent } from "./call.js";

export async function reconA(call: CallAgent, identity: Handoff, request?: Fetch,
  discovery_scope: z.infer<typeof reconASchema>["discovery_scope"] = null) {
  let dex: Timed<Awaited<ReturnType<typeof dexScreener>>> | undefined;
  let gecko: Timed<Awaited<ReturnType<typeof geckoTerminal>>> | undefined;
  const model = await call({
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
  return { value: { summary: model.summary, price_usd: dex.value.price_usd,
      vol_1h_usd: dex.value.vol_1h_usd, created_at_ms: dex.value.created_at_ms,
      provenance: { price_usd: { source: "dexscreener" as const, observed_at: dex.observedAt, value: dex.value.price_usd },
        liquidity_usd: { source: "aggregated" as const, observed_at: Math.min(dex.observedAt, gecko.observedAt),
          value: Math.min(dex.value.liquidity_usd, gecko.value.liquidity_usd) } },
    liquidity_usd: Math.min(dex.value.liquidity_usd, gecko.value.liquidity_usd) },
  observedAt: Math.min(dex.observedAt, gecko.observedAt) };
}
