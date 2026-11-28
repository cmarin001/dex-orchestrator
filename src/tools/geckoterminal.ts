import { candleSchema } from "../../schemas/early-momentum.js";
import { z } from "zod";
import { normalizeAddress } from "../../schemas/common.js";
import type { Target } from "../../schemas/common.js";
import { CandidateError } from "../orchestrator/errors.js";
import { getJson } from "./dexscreener.js";
import type { Fetch } from "./dexscreener.js";

const networks = { ethereum: "eth", polygon: "polygon_pos", arbitrum: "arbitrum", optimism:"optimism", bsc: "bsc", base: "base", solana: "solana" };
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

const minuteOhlcv = z.object({
  data:z.object({attributes:z.object({ohlcv_list:z.array(z.tuple([
    z.number().int().nonnegative(),z.number(),z.number(),z.number(),z.number(),z.number(),
  ])).max(240)})}),
  meta:z.object({base:z.object({address:z.string()}),quote:z.object({address:z.string()})}),
});

export async function geckoMinuteCandles(target:Target, at:number, request:Fetch=fetch) {
  const {chain,pair,token}=target;
  const url=new URL(`https://api.geckoterminal.com/api/v2/networks/${networks[chain]}/pools/${encodeURIComponent(pair)}/ohlcv/minute`);
  url.search=new URLSearchParams({aggregate:"1",limit:"120",currency:"usd",token,
    include_empty_intervals:"false",before_timestamp:String(Math.floor(at/1000))}).toString();
  const parsed=minuteOhlcv.safeParse(await getJson(url,request,{Accept:"application/json;version=20230203"}));
  if (!parsed.success || ![parsed.data.meta.base.address,parsed.data.meta.quote.address].some(address=>normalizeAddress(chain,address)===token)) {
    throw new CandidateError("GeckoTerminal returned no matching OHLCV token");
  }
  const candles=parsed.data.data.attributes.ohlcv_list
    .filter(([timestamp])=>timestamp*1000+60_000<=at)
    .map(([timestamp,open,high,low,close,volumeUsd])=>candleSchema.parse({openAt:timestamp*1000,open,high,low,close,volumeUsd}))
    .sort((a,b)=>a.openAt-b.openAt);
  if (new Set(candles.map(c=>c.openAt)).size!==candles.length) throw new CandidateError("GeckoTerminal returned duplicate candles");
  return candles;
}
