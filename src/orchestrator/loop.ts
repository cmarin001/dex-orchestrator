import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import type { Target } from "../../schemas/common.js";
import { reconA } from "../agents/recon-a.js";
import { reconB } from "../agents/recon-b.js";
import { reconC } from "../agents/recon-c.js";
import { merge, targetKey } from "../cache/merge.js";
import type { Freshness, Market, Security } from "../cache/merge.js";
import { TtlCache } from "../cache/ttl.js";
import { CandidateError, SystemError } from "./errors.js";
import { discover } from "../tools/discovery.js";
import type { DiscoveryScope } from "../tools/discovery.js";
import { runCandidate } from "./pipeline.js";
import type { Pipeline } from "./pipeline.js";

export interface LoopOptions {
  targets: readonly Target[];
  ttl: Freshness;
  intervalMs: number;
  breakerFailures: number;
  breakerCooldownMs: number;
  socialEnabled: boolean;
  discovery?: DiscoveryScope;
  goPlusAccessToken?: string;
}

export async function runLoop(options: LoopOptions, pipeline: Pipeline, signal: AbortSignal): Promise<void> {
  const marketCache = new TtlCache<Market["value"]>(options.ttl.marketMs);
  const securityCache = new TtlCache<Security["value"]>(options.ttl.securityMs);
  let failures = 0;
  let discoveryBaseline: Awaited<ReturnType<typeof discover>>["statistics"] | undefined;
  while (!signal.aborted) {
    const started = Date.now();
    let delay = options.intervalMs;
    let targets = options.targets;
    let scope = null;
    if (options.discovery) {
      try {
        const found = await discover(options.discovery, undefined, discoveryBaseline);
        discoveryBaseline = found.statistics;
        targets = [...new Map([...options.targets, ...found.targets].map(target => [targetKey(target), target])).values()];
        scope = { chains: [...new Set(found.scope.sources.map(({ chain }) => chain))], triggers: found.scope.triggers,
          pools_scanned: Object.values(found.counts).reduce((total, count) => total + count, 0) };
        await pipeline.audit({ stage: "market_discovery", status: "ok", gaps: [], detail: { ...scope, counts: found.counts } });
      } catch (error) {
        discoveryBaseline = undefined;
        await pipeline.audit({ stage: "market_discovery", status: "failed", gaps: ["discovery_unavailable"],
          detail: error instanceof Error ? error.message : "Unknown discovery error" });
      }
    }
    for (const target of targets) {
      if (signal.aborted) break;
      const identity = { ...target, run_id: randomUUID() };
      const key = targetKey(target);
      try {
        const observations = await Promise.allSettled([
          marketCache.get(key) ?? reconA(pipeline.call, identity, undefined, scope),
          securityCache.get(key) ?? reconB(pipeline.call, identity, undefined, options.goPlusAccessToken),
          options.socialEnabled ? reconC(pipeline.call, identity) : undefined,
        ] as const);
        const [market, security, social] = observations;
        if (market.status === "fulfilled") marketCache.set(key, market.value);
        if (security.status === "fulfilled") securityCache.set(key, security.value);
        if (social.status === "rejected") {
          await pipeline.audit({ identity, stage: "recon-c", status: "failed", gaps: ["social_unavailable"] });
        }
        for (const required of [market, security]) {
          if (required.status === "rejected" && !(required.reason instanceof CandidateError)) {
            throw required.reason;
          }
        }
        const merged = merge(identity, marketCache.get(key), securityCache.get(key),
          social.status === "fulfilled" ? social.value : undefined, options.ttl);
        await pipeline.audit({ identity, stage: "merge", status: "ok", gaps: merged.gaps,
          detail: { market: merged.market, security: merged.security, expires_at: merged.expires_at } });
        await runCandidate(merged, { ...pipeline, signal });
        failures = 0;
      } catch (error) {
        if (!(error instanceof CandidateError || error instanceof SystemError)) throw error;
        await pipeline.audit({ identity, stage: "pipeline", status: "failed",
          gaps: [error.name], detail: error.message });
        if (error instanceof CandidateError) continue;
        failures += 1;
        if (failures >= options.breakerFailures) {
          await pipeline.audit({ stage: "breaker", status: "failed", gaps: ["breaker_open"],
            detail: { cooldown_ms: options.breakerCooldownMs, failures } });
          delay = Math.max(delay, Date.now() - started + options.breakerCooldownMs);
          break;
        }
      }
    }
    await sleep(Math.max(0, delay - (Date.now() - started)), undefined, { signal }).catch((error: unknown) => {
      if (!signal.aborted) throw error;
    });
  }
}
