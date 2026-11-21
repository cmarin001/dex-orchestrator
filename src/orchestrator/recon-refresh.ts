import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import type { Target } from "../../schemas/common.js";
import type { MarketSnapshot } from "../../schemas/recon-snapshot.js";
import { reconA } from "../agents/recon-a.js";
import { reconB } from "../agents/recon-b.js";
import type { ReconCache } from "../cache/recon-cache.js";
import { reconKey } from "../cache/merge.js";
import { failureKind, log, withLogContext } from "../logging/operational.js";
import { discover } from "../tools/discovery.js";
import type { LoopOptions } from "./loop.js";
import type { Pipeline } from "./pipeline.js";

const discoveryIntervalMs = 60_000;
const watchedIntervalMs = 300_000;
const retryIntervalMs = 600_000;
type Schedule = { target: Target; watched: boolean; trigger: MarketSnapshot["trigger"]; starts: number; due: number };

export async function refreshRecon(options: LoopOptions, pipeline: Pipeline, cache: ReconCache, signal: AbortSignal) {
  const schedules = new Map<string, Schedule>();
  let baseline: Awaited<ReturnType<typeof discover>>["statistics"] | undefined;
  let scope: Parameters<typeof reconA>[3] = null;
  while (!signal.aborted) {
    const started = Date.now();
    const watched = new Map<string, Target>();
    for (const { chain, token, pair } of [...options.targets, ...pipeline.positions.list()]) {
      const target = { chain, token, pair };
      watched.set(reconKey(target), target);
    }
    for (const [key, target] of watched) {
      const existing = schedules.get(key);
      if (!existing?.watched || existing.target.pair !== target.pair) {
        schedules.set(key, { target, watched: true, trigger: "new_pair", starts: 0, due: started });
      }
    }
    for (const [key, item] of schedules) {
      if (item.watched && !watched.has(key)) {
        schedules.delete(key);
        cache.remove(item.target);
      }
    }
    if (options.discovery) {
      try {
        const found = await discover(options.discovery, undefined, baseline);
        baseline = found.statistics;
        scope = { chains: [...new Set(found.scope.sources.map(({ chain }) => chain))], triggers: found.scope.triggers,
          pools_scanned: Object.values(found.counts).reduce((total, count) => total + count, 0) };
        for (const [key, item] of schedules) {
          if (!item.watched && !baseline.has(item.target.chain + ":" + item.target.pair)) {
            schedules.delete(key);
            cache.remove(item.target);
          }
        }
        for (const { chain, token, pair, trigger } of found.targets) {
          const target = { chain, token, pair };
          const key = reconKey(target);
          if (!schedules.has(key)) schedules.set(key, { target, watched: false, trigger, starts: 0, due: started });
        }
        log("info", "discovery.completed", { count: scope.pools_scanned });
        await pipeline.audit({ stage: "market_discovery", status: "ok", gaps: [], detail: { ...scope, counts: found.counts } });
      } catch (error) {
        baseline = undefined;
        scope = null;
        log("warn", "discovery.failed", { failure_kind: failureKind(error) });
        await pipeline.audit({ stage: "market_discovery", status: "failed", gaps: ["discovery_unavailable"] });
      }
    }
    for (const item of schedules.values()) cache.track(item.target, item.watched);
    for (const item of schedules.values()) {
      if (signal.aborted) break;
      if (cache.isRejected(item.target)) {
        item.starts = 0;
        item.due = started;
        continue;
      }
      if (item.due > started || (!item.watched && !baseline?.has(item.target.chain + ":" + item.target.pair))) continue;
      item.starts += 1;
      item.due = item.watched ? started + watchedIntervalMs : item.starts === 1 ? started + retryIntervalMs : Infinity;
      const identity = { ...item.target, run_id: randomUUID() };
      await withLogContext({ run_id: identity.run_id, chain: identity.chain }, async () => {
        const [security, market] = await Promise.allSettled([
          reconB(pipeline.call, identity, undefined, options.goPlusAccessToken),
          reconA(pipeline.call, identity, undefined, scope, item.trigger),
        ]);
        if (signal.aborted) return;
        const failedAt = Date.now();
        const safe = security.status === "fulfilled" ? security.value : {
          source_fetched_at: failedAt, assessment: "unknown" as const, checks_raw: {}, sources_disagree: false,
          provenance: { recon_b: { source: "recon_b", fetched_at: failedAt, ok: false } }, reasons: [],
        };
        const { reasons, ...securitySnapshot } = safe;
        const gaps = [
          ...(market.status === "rejected" ? ["recon_a_missing"] : []),
          ...(safe.assessment === "unknown" ? ["recon_b_incomplete"] : []),
        ];
        cache.put({ target: item.target, security: securitySnapshot, social: null,
          ...(market.status === "fulfilled" ? { market: market.value } : { market_failed_at: failedAt }) });
        log(gaps.length ? "warn" : "info", "recon.refreshed", { gap_count: gaps.length,
          ...(market.status === "rejected" ? { market_failure_kind: failureKind(market.reason) } : {}),
          ...(security.status === "rejected" ? { security_failure_kind: failureKind(security.reason) } : {}) });
        await pipeline.audit({ identity, stage: "recon", status: gaps.length ? "failed" : "ok", gaps, detail: { reasons } });
      });
    }
    await sleep(Math.max(0, started + discoveryIntervalMs - Date.now()), undefined, { signal }).catch((error: unknown) => {
      if (!signal.aborted) throw error;
    });
  }
}
