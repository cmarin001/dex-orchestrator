import { z } from "zod";
import { normalizeAddress } from "../../schemas/common.js";
import type { Target } from "../../schemas/common.js";
import { elapsed, failureKind, log, startTimer } from "../logging/operational.js";
import { CandidateError, SystemError } from "../orchestrator/errors.js";

export type Fetch = typeof fetch;

export async function getJson(url: URL, request: Fetch, headers?: HeadersInit): Promise<unknown> {
  const started = startTimer();
  let status: number | undefined;
  try {
    const response = await request(url, { headers, signal: AbortSignal.timeout(8000), redirect: "error" });
    status = response.status;
    if (response.status === 404) throw new CandidateError(`No data from ${url.hostname}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: unknown = await response.json();
    log("debug", "provider.request", { provider: url.hostname, status, duration_ms: elapsed(started), outcome: "ok" });
    return data;
  } catch (cause) {
    log("warn", "provider.request", { provider: url.hostname, status, duration_ms: elapsed(started),
      outcome: "failed", failure_kind: failureKind(cause) });
    if (cause instanceof CandidateError) throw cause;
    throw new SystemError(`Provider unavailable: ${url.hostname}`, { cause });
  }
}

const response = z.object({
  pairs: z.array(z.object({
    chainId: z.string(),
    pairAddress: z.string(),
    baseToken: z.object({ address: z.string() }),
    priceUsd: z.string(),
    liquidity: z.object({ usd: z.number().nonnegative() }),
  })).nullable(),
});

export async function dexScreener(target: Target, request: Fetch = fetch) {
  const { chain, token, pair } = target;
  const url = new URL(`https://api.dexscreener.com/latest/dex/pairs/${chain}/${encodeURIComponent(pair)}`);
  const payload = response.safeParse(await getJson(url, request));
  const result = payload.success && payload.data.pairs?.find((entry) =>
    entry.chainId === chain && normalizeAddress(chain, entry.pairAddress) === pair &&
    normalizeAddress(chain, entry.baseToken.address) === token,
  );
  if (!result || !Number.isFinite(Number(result.priceUsd)) || Number(result.priceUsd) <= 0) {
    throw new CandidateError("DexScreener returned no matching priced pair");
  }
  return { price_usd: Number(result.priceUsd), liquidity_usd: result.liquidity.usd };
}
