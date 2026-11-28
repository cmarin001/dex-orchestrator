import { dexScreener } from "../tools/dexscreener.js";
import type { MarketMarkProvider } from "./contract.js";

export const dexScreenerMarks:MarketMarkProvider={
  async mark(target,signal) {
    const result=await dexScreener(target,signal ? (input,init)=>fetch(input,{
      ...init,signal:init?.signal?AbortSignal.any([signal,init.signal]):signal,
    }) : fetch);
    return {source:"dexscreener",price_usd:result.price_usd,vol_24h_usd:result.vol_24h_usd,market_cap_usd:result.market_cap_usd};
  },
};
