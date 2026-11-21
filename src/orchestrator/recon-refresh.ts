import { reconC } from "../agents/recon-c.js";
import { socialActions } from "../tools/social.js";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import type { Target } from "../../schemas/common.js";
import type { MarketSnapshot } from "../../schemas/recon-snapshot.js";
import { toRugChecks } from "../../schemas/recon-checks.js";
import { dexScreener } from "../tools/dexscreener.js";
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
  while (!signal.aborted) {
    const started = Date.now();
    const watched = new Map<string, Target>();
    for (const { chain, token, pair } of [...options.targets, ...pipeline.positions.list()]) {
      const target = { chain, token, pair };
      watched.set(reconKey(target), target);
    }
    for (const [key, target] of watched) {
      if (pipeline.mode && !pipeline.mode.chain.enabledChains.includes(target.chain) && !pipeline.positions.get(target)) continue;
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
        const scopeNow = pipeline.mode ? {...options.discovery,sources:options.discovery.sources.filter(source=>
          pipeline.mode!.chain.enabledChains.includes(source.chain))} : options.discovery;
        const found = await discover(scopeNow, undefined, baseline);
        baseline = found.statistics;
        const scope = {
          chains: [...new Set(found.scope.sources.map(({ chain }) => chain))],
          triggers: found.scope.triggers,
          pools_scanned: Object.values(found.counts).reduce((total, count) => total + count, 0),
        };
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
        await pipeline.audit({
          stage: "market_discovery",
          status: "ok",
          gaps: [],
          detail: { ...scope, counts: found.counts },
        });
      } catch (error) {
        baseline = undefined;
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
      item.due = item.watched ? started + (pipeline.mode ? 60_000 : watchedIntervalMs) : item.starts === 1 ? started + retryIntervalMs : Infinity;
      const identity = { ...item.target, run_id: randomUUID() };
      await withLogContext({ run_id: identity.run_id, chain: identity.chain }, async () => {
        const mode = item.trigger === "new_pair" ? "new_pairs" : item.trigger;
        let gaps: string[] = [],
          reasons: string[] = [];
        try {
          const rows = await reconA(pipeline.call, identity, {
            run_id: identity.run_id,
            chain: identity.chain,
            modes: [mode],
            seen: [],
            config: { min_liquidity_usd: 15000, min_vol_1h_usd: 10000, min_age_sec: 600, max_age_sec: 86400 },
          });
          const row = rows.find(
            (r) => !("status" in r) && !r.skipped && r.token === identity.token && r.pair === identity.pair,
          );
          if (!row || "status" in row) throw new Error("No matching market observation");
          const sourceTime = row.source_fetched_at * 1000;
          const field = (value: number) => ({ value, source: row.source, fetched_at: sourceTime });
          const priceTime = Date.now();
          const price = await dexScreener(identity);
          const indicative = (value:number)=>({value,source:"dexscreener",fetched_at:priceTime});
          const market = {
            source_fetched_at: sourceTime,
            trigger: row.trigger,
            liquidity_usd: field(row.liquidity_usd),
            vol_1h_usd: field(row.vol_1h_usd),
            age_sec: field(row.age_sec),
            price_usd: { value: price.price_usd, source: "dexscreener", fetched_at: priceTime },
            vol_24h_usd:price.vol_24h_usd===undefined?undefined:indicative(price.vol_24h_usd),
            market_cap_usd:price.market_cap_usd===undefined?undefined:indicative(price.market_cap_usd),
          };
          try {
            const risk = await reconB(
              pipeline.call,
              identity,
              row.age_sec,
              fetch,
              options.goPlusAccessToken,
              options.etherscanApiKey,
            );
            const checks_raw = toRugChecks(risk.checks_raw);
            const sources = Object.entries(risk.provenance).filter(([, source]) => source.ok);
            const fetched_at = sources.length ? Math.min(...sources.map(([, s]) => s.fetched_at * 1000)) : Date.now();
            const provenance = Object.fromEntries(
              sources.map(([name, s]) => [name, { source: name, ok: true, fetched_at: s.fetched_at * 1000 }]),
            );
            for (const [key, value] of Object.entries(checks_raw)) {
              if (typeof value === "number" && sources.length)
                provenance[key] = { source: sources.map(([n]) => n).join("+"), fetched_at, ok: true };
            }
            const snapshot={
              target: item.target,
              market,
              security: {
                source_fetched_at: fetched_at,
                checks_raw,
                provenance,
                assessment: risk.sources_disagree || !sources.length ? "unknown" : "clear",
                sources_disagree: risk.sources_disagree,
              },
            } as const;
            cache.put(snapshot);
            if (pipeline.mode) pipeline.mode.observe(cache.read(identity));
            reasons = [risk.reason];
          } catch (error) {
            gaps = ["recon_b_incomplete"];
            reasons = [failureKind(error)];
            cache.put({ target: item.target, market });
          }
        } catch (error) {
          cache.put({ target: item.target, market_failed_at: Date.now() });
          gaps = ["recon_a_missing"];
          reasons = [failureKind(error)];
        }
        await pipeline.audit({
          identity,
          stage: "recon",
          status: gaps.length ? "failed" : "ok",
          gaps,
          detail: { reasons },
        });
        const actions = socialActions([identity.token], 60, fetch, options.social);
        if (actions.length && !signal.aborted && !gaps.length && (!pipeline.mode || pipeline.mode.usesModels())) {
          try {
            const social = await reconC(
              pipeline.call,
              identity,
              { run_id: identity.run_id, chain: identity.chain, tokens: [identity.token], window_minutes: 60 },
              actions,
            );
            await pipeline.audit({ identity, stage: "recon-c", status: "ok", gaps: [], detail: social });
          } catch (error) {
            await pipeline.audit({
              identity,
              stage: "recon-c",
              status: "failed",
              gaps: ["social_unavailable"],
              detail: failureKind(error),
            });
          }
        }
      });
    }
    await sleep(Math.max(0, started + discoveryIntervalMs - Date.now()), undefined, { signal }).catch(
      (error: unknown) => {
        if (!signal.aborted) throw error;
      },
    );
  }
}
