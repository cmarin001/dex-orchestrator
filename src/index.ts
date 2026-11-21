import { chartPointSchema } from "../schemas/live-view.js";
import { defaultRisk } from "../schemas/risk-config.js";
import { normalizeAddress, targetSchema } from "../schemas/common.js";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { responsesAgent } from "./agents/call.js";
import { REJECTION_TTL_MS, targetKey } from "./cache/merge.js";
import { fileAudit, readJournal } from "./logging/logger.js";
import { failureKind, log } from "./logging/operational.js";
import { ReconCache } from "./cache/recon-cache.js";
import { refreshRecon } from "./orchestrator/recon-refresh.js";
import { runLoop } from "./orchestrator/loop.js";
import { Equity } from "./state/equity.js";
import { Positions } from "./state/positions.js";
import { watchPositions } from "./exits/watcher.js";

import { readRisk, requireFreshRisk } from "./state/risk-config.js";
import { rugCheckSchema } from "../schemas/rug-check.js";
import { scopeSchema } from "./tools/discovery.js";

const integer = z.coerce.number().int().positive();
const config = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  WATCHLIST: z.string().default("[]"),
  LOOP_INTERVAL_MS: integer.max(2_147_483_647).default(90_000),
  BREAKER_FAILURES: integer.default(3),
  BREAKER_COOLDOWN_MS: integer.max(2_147_483_647).default(180_000),
  INITIAL_EQUITY_CENTS: integer.default(100_000),
  MAX_POSITION_BPS: integer.max(10_000).default(100),
  MAX_OPEN_POSITIONS: integer.default(5),
  AUDIT_PATH: z.string().min(1).default("data/audit.jsonl"),
  ENABLE_DISCOVERY: z.enum(["true", "false"]).default("false"),
  MARK_REFRESH_MS: integer.max(2_147_483_647).default(5000),
  PAPER_EXIT_MODE: z.enum(["profit_only", "stop_loss"]).default("profit_only"),
  RISK_CONFIG_PATH: z.string().default("data/risk-config.jsonl"),
  REQUIRE_RISK_CONFIG: z.enum(["true", "false"]).default("false"),
  MAX_EQUITY_AGE_SEC: integer.default(120),
  MAX_RISK_CONFIG_AGE_SEC: integer.default(3600),
  GOPLUS_ACCESS_TOKEN: z.string().optional(),
});

async function main(): Promise<void> {
  log("info", "worker.starting");
  const env = config.parse(process.env);
  const discovery = env.ENABLE_DISCOVERY === "true" ? scopeSchema.parse(
    JSON.parse(await readFile(new URL("../config/default.json", import.meta.url), "utf8")).discovery_scope,
  ) : undefined;
  const targets = z.array(targetSchema).parse(JSON.parse(env.WATCHLIST) as unknown)
    .map(({ chain, token, pair }) => ({ chain, token: normalizeAddress(chain, token), pair: normalizeAddress(chain, pair) }));
  if (!targets.length && !discovery) throw new Error("Configure a watchlist or enable discovery");
  const uniqueTargets = [...new Map(targets.map((target) => [targetKey(target), target])).values()];
  const equity = new Equity(env.INITIAL_EQUITY_CENTS);
  const positions = new Positions();
  const cache = new ReconCache();
  const audit = fileAudit(env.AUDIT_PATH);
  const rejectionCutoff = Date.now() - REJECTION_TTL_MS;
  for (const event of await readJournal(env.AUDIT_PATH)) {
    const { position, close, identity } = event;
    if (event.stage === "rug-check" && identity && Date.parse(event.at) > rejectionCutoff &&
        rugCheckSchema.safeParse(event.detail).data?.verdict === "FAIL") {
      cache.reject(identity, Date.parse(event.at));
    } else if (event.status === "paper_fill" && position) {
      positions.record(position);
      equity.mark(position, position.entry_price_usd, Date.parse(event.at));
    } else if (event.status === "paper_close" && position && close) {
      positions.close(position);
      equity.close(position, close.proceeds_cents, close.exit_at);
    } else if (event.stage === "position_mark" && identity) {
      const open = positions.get(identity);
      const point = chartPointSchema.safeParse(event.detail);
      if (open && open.run_id === identity.run_id && point.success) equity.mark(open, point.data.price, point.data.t);
    }
  }
  const abort = new AbortController();
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => { log("info", "worker.shutdown_requested", { reason: signal }); abort.abort(); });
  }
  log("info", "worker.started", { count: uniqueTargets.length });
  const watcher = watchPositions(positions, equity, audit, abort.signal, env.MARK_REFRESH_MS).finally(() => abort.abort());
  const options = {
    targets: uniqueTargets, discovery, intervalMs: env.LOOP_INTERVAL_MS,
    breakerFailures: env.BREAKER_FAILURES, breakerCooldownMs: env.BREAKER_COOLDOWN_MS,
    goPlusAccessToken: env.GOPLUS_ACCESS_TOKEN,
  };
  const pipeline = {
    call: responsesAgent(env.OPENAI_API_KEY, env.OPENAI_MODEL, abort.signal), audit,
    exitMode: env.PAPER_EXIT_MODE,
    equityMaxAgeMs: env.MAX_EQUITY_AGE_SEC * 1000,
    riskConfig: async () => {
      const revision = await readRisk(env.RISK_CONFIG_PATH);
      return revision || env.REQUIRE_RISK_CONFIG === "true"
        ? requireFreshRisk(revision, Date.now(), env.MAX_RISK_CONFIG_AGE_SEC * 1000) : defaultRisk;
    },
    equity, positions, maxPositionBps: env.MAX_POSITION_BPS, maxOpenPositions: env.MAX_OPEN_POSITIONS,
  };
  const refresh = refreshRecon(options, pipeline, cache, abort.signal).finally(() => abort.abort());
  const loop = runLoop(options, pipeline, abort.signal, cache).finally(() => abort.abort());
  const results = await Promise.allSettled([loop, refresh, watcher]);
  for (const result of results) if (result.status === "rejected") throw result.reason;
  log("info", "worker.stopped");
}

await main().catch((error: unknown) => {
  log("error", "worker.failed", { failure_kind: failureKind(error) });
  process.exitCode = 1;
});
