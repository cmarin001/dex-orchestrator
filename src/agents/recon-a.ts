import { poolEvidence } from "../tools/recon-evidence.js";
import { z } from "zod";
import type { Handoff } from "../../schemas/common.js";
import { reconAInput, reconASchema } from "../../schemas/recon-a.js";
import type { Fetch } from "../tools/dexscreener.js";
import { reconAction } from "../tools/recon-action.js";
import type { CallAgent } from "./call.js";

export function reconA(call: CallAgent, identity: Handoff, data: z.input<typeof reconAInput>, request: Fetch = fetch) {
  const input = reconAInput.parse(data);
  if (input.chain !== identity.chain || input.run_id !== identity.run_id) throw new Error("Recon A identity mismatch");
  const { chain } = input;
  const network = {
    ethereum: "eth",
    polygon: "polygon_pos",
    arbitrum: "arbitrum",
    base: "base",
    solana: "solana",
    bsc: "bsc",
  }[chain];
  const actions = {
    new_pairs: reconAction(
      "geckoterminal_new_pools",
      { network: chain },
      new URL("https://api.geckoterminal.com/api/v2/networks/" + network + "/new_pools"),
      request,
      undefined,
      (d, t) => poolEvidence(d, "new_pairs", chain, t),
    ),
    vol_spike: reconAction(
      "geckoterminal_trending",
      { network: chain },
      new URL("https://api.geckoterminal.com/api/v2/networks/" + network + "/trending_pools"),
      request,
      undefined,
      (d, t) => poolEvidence(d, "vol_spike", chain, t),
    ),
    liq_spike: reconAction(
      "dexscreener_search",
      { query: "trending " + chain },
      new URL("https://api.dexscreener.com/latest/dex/search?" + new URLSearchParams({ q: "trending " + chain })),
      request,
      undefined,
      (d, t) => poolEvidence(d, "liq_spike", chain, t),
    ),
  };
  const selected = [...new Set(input.modes)].map((mode) => actions[mode]);
  const wireSchema = z.strictObject({ rows: reconASchema });
  return call({
    identity,
    prompt: "recon-a-market-intel",
    schema: reconASchema,
    data: input,
    wireSchema,
    tools: [
      ...selected.map((action) => action.tool),
      reconAction(
        "dexscreener_token",
        { address: identity.token, chain },
        new URL("https://api.dexscreener.com/token-pairs/v1/" + chain + "/" + encodeURIComponent(identity.token)),
        request,
      ).tool,
    ],
    wire: (value) => wireSchema.parse(value).rows,
    validate: (rows) => {
      const seen = new Set(input.seen);
      const expected = selected.flatMap((action) => {
        const o = action.observation();
        return o?.ok && Array.isArray(o.data) ? [...o.data] : [];
      });
      const errors = selected.filter((a) => a.observation()?.ok === false);
      if (rows.length !== expected.length + errors.length) return false;
      return (
        selected.every((action) => action.observation() !== undefined) &&
        rows.every((row) => {
          if ("status" in row) {
            const i = errors.findIndex((a) => row.source === a.tool.name || a.tool.name.startsWith(row.source));
            if (i < 0) return false;
            errors.splice(i, 1);
            return true;
          }
          const index = expected.findIndex((item) =>
            Object.entries(item).every(([k, v]) => row[k as keyof typeof row] === v),
          );
          if (index < 0) return false;
          expected.splice(index, 1);
          const filtered =
            seen.has(row.token) ||
            row.age_sec < input.config.min_age_sec ||
            row.age_sec > input.config.max_age_sec ||
            row.vol_1h_usd < input.config.min_vol_1h_usd ||
            row.liquidity_usd < input.config.min_liquidity_usd;
          if (!row.skipped) seen.add(row.token);
          return (
            row.run_id === input.run_id &&
            row.chain === chain &&
            row.skipped === filtered &&
            selected.some(
              (action) => action.observation()?.ok && action.observation()?.fetched_at === row.source_fetched_at,
            )
          );
        })
      );
    },
  });
}
