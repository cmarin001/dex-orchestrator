import { normalizeAddress } from "../../schemas/common.js";
import type { Handoff, Target } from "../../schemas/common.js";
import type { ReconSnapshot } from "../../schemas/recon-snapshot.js";
import { CandidateError } from "../orchestrator/errors.js";

export const NEW_TTL_MS = 300_000;
export const WATCHED_TTL_MS = 60_000;
export const targetKey = ({ chain, token, pair }: Target): string => `${chain}:${normalizeAddress(chain, token)}:${normalizeAddress(chain, pair)}`;
export const reconKey = ({ chain, token }: Pick<Target,"chain"|"token">): string => `${chain}:${normalizeAddress(chain, token)}`;

export function merge(identity: Handoff, snapshot: ReconSnapshot | undefined, ttlMs = NEW_TTL_MS, now = Date.now()) {
  const current = snapshot && targetKey(snapshot.target) === targetKey(identity) ? snapshot : undefined;
  const { market, security, social } = current ?? {};
  const fresh = (at: number) => Number.isSafeInteger(at) && at >= 0 && at <= now && now - at <= ttlMs;
  const evidenceError = market && [market.price_usd, market.liquidity_usd, market.vol_1h_usd, market.age_sec].some(field =>
    !field?.source || !Number.isFinite(field.value) || !Number.isSafeInteger(field.fetched_at) || field.fetched_at < 0);
  const raw = security?.checks_raw ?? {};
  const securityError = Object.entries(raw).some(([field, value]) => {
    if (typeof value !== "number") return false;
    const origin = security?.provenance[field];
    return !Number.isFinite(value) || !origin?.source || !Number.isSafeInteger(origin.fetched_at) ||
      origin.fetched_at < 0 || origin.ok === false;
  });
  if (evidenceError || securityError || (social && (!social.source || !Number.isFinite(social.value) ||
      !Number.isSafeInteger(social.fetched_at) || social.fetched_at < 0))) {
    throw new CandidateError("recon_provenance_missing");
  }
  const marketTimes = market ? [market.source_fetched_at, ...[market.price_usd, market.liquidity_usd,
    market.vol_1h_usd, market.age_sec].map(field => field.fetched_at)] : [];
  const marketFresh = market && marketTimes.every(fresh);
  const securityTimes = security ? [security.source_fetched_at, ...Object.values(security.provenance).map(field => field.fetched_at)] : [];
  const securityFresh = security && securityTimes.every(fresh);
  const social_score = social && fresh(social.fetched_at) ? social.value : null;
  const stale = !marketFresh || !securityFresh;
  const gap = stale ? current?.market_failed_at !== undefined && fresh(current.market_failed_at) && !market ? "recon_a_missing" : "stale_recon" : null;
  return {
    identity, stale, gap, expected_slippage_bps: current?.expected_slippage_bps ?? 0,
    feed_entry: marketFresh ? {
      token: identity.token, pair: identity.pair, chain: identity.chain, trigger: market.trigger,
      liquidity_usd: market.liquidity_usd.value, vol_1h_usd: market.vol_1h_usd.value,
      age_sec: market.age_sec.value, social_score, as_of: Math.floor(market.source_fetched_at / 1000),
    } : null,
    quote: marketFresh ? market.price_usd : null,
    checks_raw: securityFresh ? security.checks_raw : {},
    provenance: securityFresh ? security.provenance : {},
    assessment: securityFresh ? security.assessment : "unknown" as const,
    sources_disagree: securityFresh ? security.sources_disagree : false,
    expires_at: stale ? null : Math.min(...marketTimes, ...securityTimes) + ttlMs,
    gaps: gap ? [gap] : [],
  };
}
export type Merged = ReturnType<typeof merge>;
