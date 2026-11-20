import { randomUUID } from "node:crypto";
import { setTimeout as sleep } from "node:timers/promises";
import type { Target } from "../../schemas/common.js";
import type { ReconCache } from "../cache/recon-cache.js";
import { elapsed, failureKind, log, startTimer, withLogContext } from "../logging/operational.js";
import { CandidateError, SystemError } from "./errors.js";
import type { DiscoveryScope } from "../tools/discovery.js";
import { runCandidate } from "./pipeline.js";
import type { Pipeline } from "./pipeline.js";

export interface LoopOptions {
  targets: readonly Target[];
  intervalMs: number;
  breakerFailures: number;
  breakerCooldownMs: number;
  discovery?: DiscoveryScope;
  goPlusAccessToken?: string;
}

export async function runLoop(options: LoopOptions, pipeline: Pipeline, signal: AbortSignal, cache: ReconCache): Promise<void> {
  let failures = 0;
  log("info", "loop.started", { count: options.targets.length });
  while (!signal.aborted) {
    const cycleStarted = startTimer();
    const started = Date.now();
    let delay = options.intervalMs;
    const targets = cache.list();
    for (const target of targets) {
      if (signal.aborted) break;
      const identity = { ...target, run_id: randomUUID() };
      const fields = { run_id: identity.run_id, chain: identity.chain };
      const candidateStarted = startTimer();
      try {
        await withLogContext(fields, async () => {
          if (cache.isRejected(target)) {
            await pipeline.audit({ identity, stage: "pipeline", status: "skipped", gaps: ["cached_rug_fail"] });
            log("info", "pipeline.skipped", { reason: "cached_rug_fail" });
            return;
          }
          const merged = cache.read(identity);
          await pipeline.audit({ identity, stage: "merge", status: merged.stale ? "skipped" : "ok", gaps: merged.gaps,
            detail: { expires_at: merged.expires_at } });
          const outcome = await runCandidate(merged, { ...pipeline, signal, rejectRecon: target => cache.reject(target) });
          log("info", "candidate.completed", { outcome, duration_ms: elapsed(candidateStarted) });
        });
        failures = 0;
      } catch (error) {
        log(error instanceof CandidateError ? "warn" : "error", "candidate.failed", {
          ...fields, failure_kind: failureKind(error), duration_ms: elapsed(candidateStarted),
        });
        if (!(error instanceof CandidateError || error instanceof SystemError)) throw error;
        await pipeline.audit({ identity, stage: "pipeline", status: "failed",
          gaps: [error instanceof CandidateError ? error.message : error.name], detail: error.message });
        if (error instanceof CandidateError) continue;
        failures += 1;
        if (failures >= options.breakerFailures) {
          log("warn", "loop.breaker_open", { ...fields, count: failures, cooldown_ms: options.breakerCooldownMs });
          await pipeline.audit({ stage: "breaker", status: "failed", gaps: ["breaker_open"],
            detail: { cooldown_ms: options.breakerCooldownMs, failures } });
          delay = Math.max(delay, Date.now() - started + options.breakerCooldownMs);
          break;
        }
      }
    }
    log("debug", "loop.cycle", { count: targets.length, duration_ms: elapsed(cycleStarted) });
    await sleep(Math.max(0, delay - (Date.now() - started)), undefined, { signal }).catch((error: unknown) => {
      if (!signal.aborted) throw error;
    });
  }
  log("info", "loop.stopped");
}
