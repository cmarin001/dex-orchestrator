import { scanner } from "../agents/scanner.js";
import { targetKey } from "../cache/merge.js";
import type { ScannerRow } from "../../schemas/scanner.js";
import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import type { Target } from "../../schemas/common.js";
import type { ReconCache } from "../cache/recon-cache.js";
import { elapsed, failureKind, log, startTimer, withLogContext } from "../logging/operational.js";
import { CandidateError, SystemError } from "./errors.js";
import type { DiscoveryScope } from "../tools/discovery.js";
import { runCandidate, scannerLimits } from "./pipeline.js";
import type { Pipeline } from "./pipeline.js";
import type { WorkerControls } from "../control/worker.js";

export interface LoopOptions {
  targets: readonly Target[];
  intervalMs: number;
  breakerFailures: number;
  breakerCooldownMs: number;
  discovery?: DiscoveryScope;
  goPlusAccessToken?: string;
  social?: {x?:string;reddit?:string;subreddit?:string};
  etherscanApiKey?: string;
}

export async function runLoop(
  options: LoopOptions,
  pipeline: Pipeline,
  signal: AbortSignal,
  cache: ReconCache,
  controls?: WorkerControls,
): Promise<void> {
  const seen = new Map<string, number>();
  let failures = 0;
  log("info", "loop.started", { count: options.targets.length });
  while (!signal.aborted) {
    const cycleStarted = startTimer();
    const started = Date.now();
    let delay = options.intervalMs;
    let breakerUntil: number | null = null;
    await pipeline.deployment?.acknowledge();
    await controls?.drain(pipeline.positions);
    await pipeline.mode?.beginCycle(started);
    await pipeline.live?.reconcile();
    const targets = cache.list().filter(target=>!pipeline.mode || pipeline.mode.chain.enabledChains.includes(target.chain));
    const run_id = randomUUID();
    const snapshots = new Map<string, ReturnType<ReconCache["read"]>>();
    for (const target of targets) {
      const identity = { ...target, run_id };
      try {
        const snapshot=cache.read(identity);
        pipeline.mode?.observe(snapshot);
        snapshots.set(targetKey(target),snapshot);
      } catch (error) {
        if (!(error instanceof CandidateError)) throw error;
        await pipeline.audit({ identity, stage: "merge", status: "failed", gaps: [error.message] });
      }
    }
    let ranking: Map<string, ScannerRow> | undefined;
    for (const [token, until] of seen) if (until <= started) seen.delete(token);
    const feed = [...snapshots.values()].flatMap((snapshot) => {
      if (
        !snapshot.feed_entry ||
        snapshot.stale ||
        cache.isRejected(snapshot.identity) ||
        pipeline.positions.get(snapshot.identity)
      )
        return [];
      const { as_of, social_score, ...item } = snapshot.feed_entry;
      return [item];
    });
    let rankingError: unknown;
    if (feed[0] && !pipeline.deployment?.paused()) {
      try {
        const rows = await scanner(
          pipeline.call,
          { ...feed[0], run_id },
          { run_id, feed, seen: [...seen.keys()], config: scannerLimits },
        );
        ranking = new Map(rows.map((row) => [targetKey(row), row]));
        pipeline.mode?.rankChains(rows);
        if (controls) await pipeline.audit({stage:"scanner_batch",status:"ok",gaps:[],detail:rows});
      } catch (error) {
        rankingError = error;
      }
    }
    const rank = (target: Target) => {
      const row = ranking?.get(targetKey(target));
      return row && !row.skipped ? row.rank_score : Infinity;
    };
    targets.sort((a, b) => rank(a) - rank(b));
    for (const target of targets) {
      if (signal.aborted) break;
      const identity = { ...target, run_id };
      const fields = { run_id: identity.run_id, chain: identity.chain };
      const candidateStarted = startTimer();
      try {
        await withLogContext(fields, async () => {
          if (cache.isRejected(target)) {
            await pipeline.audit({ identity, stage: "pipeline", status: "skipped", gaps: ["cached_rug_fail"] });
            log("info", "pipeline.skipped", { reason: "cached_rug_fail" });
            return;
          }
          const merged = snapshots.get(targetKey(identity));
          if (!merged) return;
          await pipeline.audit({
            identity,
            stage: "merge",
            status: merged.stale ? "skipped" : "ok",
            gaps: merged.gaps,
            detail: { expires_at: merged.expires_at },
          });
          if (rankingError && !merged.stale) throw rankingError;
          const row = ranking?.get(targetKey(identity));
          if (controls?.paused || pipeline.deployment?.paused()) return;
          const outcome = await runCandidate(
            merged,
            { ...pipeline, signal, rejectRecon: (target) => cache.reject(target) },
            row,
          );
          if (row && !row.skipped && (!pipeline.mode || outcome !== "skipped")) seen.set(target.token, Date.now() + scannerLimits.dedup_window_sec * 1000);
          log("info", "candidate.completed", { outcome, duration_ms: elapsed(candidateStarted) });
        });
        failures = 0;
      } catch (error) {
        log(error instanceof CandidateError ? "warn" : "error", "candidate.failed", {
          ...fields,
          failure_kind: failureKind(error),
          duration_ms: elapsed(candidateStarted),
        });
        if (!(error instanceof CandidateError || error instanceof SystemError)) throw error;
        await pipeline.audit({
          identity,
          stage: "pipeline",
          status: "failed",
          gaps: [error instanceof CandidateError ? error.message : error.name],
          detail: error.message,
        });
        if (error instanceof CandidateError) continue;
        failures += 1;
        if (failures >= options.breakerFailures) {
          log("warn", "loop.breaker_open", { ...fields, count: failures, cooldown_ms: options.breakerCooldownMs });
          await pipeline.audit({
            stage: "breaker",
            status: "failed",
            gaps: ["breaker_open"],
            detail: { cooldown_ms: options.breakerCooldownMs, failures },
          });
          delay = Math.max(delay, Date.now() - started + options.breakerCooldownMs);
          breakerUntil = Date.now() + options.breakerCooldownMs;
          break;
        }
      }
    }
    if (controls) await pipeline.audit({stage:"worker_cycle",status:"ok",gaps:[],
      detail:{watched:targets,breaker_until:breakerUntil,loop_interval_sec:options.intervalMs / 1000}});
    log("debug", "loop.cycle", { count: targets.length, duration_ms: elapsed(cycleStarted) });
    await sleep(Math.max(0, delay - (Date.now() - started)), undefined, { signal }).catch((error: unknown) => {
      if (!signal.aborted) throw error;
    });
  }
  log("info", "loop.stopped");
}
