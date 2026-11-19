import type { Handoff, Target } from "../../schemas/common.js";
import type { reconA } from "../agents/recon-a.js";
import type { reconB } from "../agents/recon-b.js";
import type { reconC } from "../agents/recon-c.js";
import { isFresh } from "./ttl.js";

type RecordedMarket = Awaited<ReturnType<typeof reconA>>;
export type Market = Omit<RecordedMarket, "value"> & { value: Omit<RecordedMarket["value"], "provenance"> & Partial<Pick<RecordedMarket["value"], "provenance">> };
export type Security = Awaited<ReturnType<typeof reconB>>;
export type Social = Awaited<ReturnType<typeof reconC>>;
export type Freshness = { marketMs: number; securityMs: number };

export const targetKey = ({ chain, token, pair }: Target): string => `${chain}:${token}:${pair}`;

export function merge(identity: Handoff, market: Market | undefined, security: Security | undefined,
  social: Social | undefined, ttl: Freshness, now = Date.now()) {
  const marketFresh = market && isFresh(market.observedAt, ttl.marketMs, now);
  const securityFresh = security && isFresh(security.observedAt, ttl.securityMs, now);
  return {
    identity,
    market: marketFresh ? market.value : null,
    security: securityFresh ? security.value : null,
    social: social ?? null,
    expires_at: marketFresh && securityFresh
      ? Math.min(market.observedAt + ttl.marketMs, security.observedAt + ttl.securityMs)
      : null,
    gaps: [...(marketFresh ? [] : ["market_missing_or_stale"]),
      ...(securityFresh ? [] : ["security_missing_or_stale"])],
  };
}
export type Merged = ReturnType<typeof merge>;
