import { earlyMomentumId } from "../schemas/early-momentum.js";
import { managedPolicy, MomentumPositions } from "./strategies/early-momentum/monitor.js";
import { dexScreenerMarks } from "./market-data/dexscreener.js";
import { configuredEntryGate, configuredShadow } from "./decisions/composition.js";
import { paperCostsSchema } from "./domain/paper-costs.js";
import { isFill, isClose } from "./logging/types.js";
import { chartPointSchema } from "../schemas/live-view.js";
import { defaultRisk } from "../schemas/risk-config.js";
import { normalizeAddress, targetSchema } from "../schemas/common.js";
import { readFile, mkdir, open, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { z } from "zod";
import { targetKey } from "./cache/merge.js";
import { fileAudit, readJournal } from "./logging/logger.js";
import { failureKind, log } from "./logging/operational.js";
import { ReconCache } from "./cache/recon-cache.js";
import { refreshRecon } from "./orchestrator/recon-refresh.js";
import { deploymentGate } from "./orchestrator/deployment.js";
import { runLoop } from "./orchestrator/loop.js";
import { Equity } from "./state/equity.js";
import { Positions } from "./state/positions.js";
import { watchPositions } from "./exits/watcher.js";

import { readRisk, requireFreshRisk } from "./state/risk-config.js";
import { rugCheckSchema } from "../schemas/rug-check.js";
import { scopeSchema } from "./tools/discovery.js";
import { Inbox } from "./control/commands.js";
import { WorkerControls } from "./control/worker.js";
import { configuredWallet } from "./wallet/config.js";
import { Budget } from "./providers/budget.js";
import { reasoningProviders } from "./providers/composition.js";
import { Router } from "./providers/router.js";
import { providerAgent } from "./providers/agent.js";
import { initialSettings } from "./mode/config.js";
import { ModeRuntime } from "./mode/runtime.js";
import { ControlPlane } from "./control/plane.js";
import { ConfigJournals } from "./control/config-journals.js";
import { secretText } from "./config/secrets.js";
import { tradeKey } from "../schemas/common.js";
import { Registry } from "./strategies/registry.js";
import { StrategyEvidence } from "./strategies/evidence.js";
import { createSigner } from "./wallet/signer.js";
import { createLiveExecution } from "./wallet/live.js";
import { transactionIntentSchema } from "../schemas/transaction-intent.js";

const integer = z.coerce.number().int().positive();
const config = z.object({
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
  CONTROL_INBOX_PATH: z.string().min(1).optional(),
  REQUIRE_RISK_CONFIG: z.enum(["true", "false"]).default("false"),
  MAX_EQUITY_AGE_SEC: integer.default(120),
  MAX_RISK_CONFIG_AGE_SEC: integer.default(3600),
  GOPLUS_ACCESS_TOKEN: z.string().optional(),
});

async function main(): Promise<void> {
  log("info", "worker.starting");
  const env = config.parse(process.env);
  const mode = z.enum(["paper","live"]).default("paper").parse(process.env.EXECUTION_MODE);
  if (mode === "live" && env.AUDIT_PATH === "data/audit.jsonl") throw new Error("LIVE_AUDIT_PATH_REQUIRED");
  if (mode === "paper") return run(env, mode);
  await mkdir(dirname(env.AUDIT_PATH), { recursive:true,mode:0o700 });
  const path = env.AUDIT_PATH + ".worker.lock";
  const lease = await open(path,"wx",0o600).catch(() => { throw new Error("LIVE_WORKER_LOCKED"); });
  try {
    await lease.writeFile(String(process.pid));
    await run(env,mode);
  } finally {
    await lease.close();
    await unlink(path);
  }
}

async function run(env:z.infer<typeof config>,mode:"paper"|"live"):Promise<void> {
  if (mode==="live" && process.env.PAPER_COSTS) throw new Error("PAPER_COSTS_REQUIRES_PAPER_MODE");
  const paperCosts=process.env.PAPER_COSTS ? paperCostsSchema.parse(JSON.parse(process.env.PAPER_COSTS)) : undefined;
  const wallet = mode === "live" ? await configuredWallet(process.env) : undefined;
  const journal = await readJournal(env.AUDIT_PATH);
  const audit = fileAudit(env.AUDIT_PATH);
  const entryDecision=mode==="paper" ? configuredEntryGate(process.env,audit) : undefined;
  const address = await wallet?.adapter.address();
  const previousMode = journal.find(event => event.stage === "execution_mode");
  const execution = {mode,chain:wallet?.config.chain ?? null,address:address ?? null};
  if ((previousMode && JSON.stringify(previousMode.detail) !== JSON.stringify(execution)) ||
      (mode === "live" && !previousMode && journal.length)) throw new Error("EXECUTION_JOURNAL_MISMATCH");
  if (!previousMode) await audit({stage:"execution_mode",status:"ok",gaps:[],detail:execution});
  const positions = new Positions();
  const registry=new Registry();
  await registry.reload();
  const settings=await initialSettings(process.env);
  const budgetPath=process.env.BUDGET_PATH || join(dirname(env.AUDIT_PATH),"budget.jsonl");
  const budget=new Budget(budgetPath);
  const revisions=new ConfigJournals(dirname(env.AUDIT_PATH),budgetPath);
  const plane=new ControlPlane(settings,registry,budget,audit,Date.now,wallet?.config.chain);
  for (const event of journal) plane.replay(event);
  const cache = new ReconCache();
  const controls = new WorkerControls(new Inbox(env.CONTROL_INBOX_PATH ?? env.AUDIT_PATH + ".controls"), env.RISK_CONFIG_PATH, cache, audit, mode === "live", plane, revisions);
  for (const event of journal) controls.replay(event);
  const enabled = () => controls.liveExecutionEnabled;
  const deployment = deploymentGate(env.AUDIT_PATH);
  const signer = wallet && createSigner(wallet.adapter,wallet.config,audit,journal,undefined,intent => intent.reduce_only ? controls.liveExitEnabled : enabled(), () => controls.safety.state());
  if (wallet?.native && signer) {
    const native = wallet.native;
    const intent = transactionIntentSchema.parse({run_id:native.run_id,chain:"bitcoin",token_in:native.address,
      token_out:native.recipient,amount_in:native.satoshis,min_amount_out:native.satoshis,
      size_cents:native.size_cents,deadline_sec:native.deadline_sec,max_fee_native:wallet.config.max_fee_native,route:"native",reduce_only:false});
    await controls.drain(positions);
    const receipt = enabled() && !controls.paused && !deployment.paused() ? await signer.signAndSend(intent, () => !deployment.paused()) : await signer.reconcile(intent);
    log("info","bitcoin.transfer_reconciled",{run_id:intent.run_id,outcome:receipt?.status ?? "not_submitted"});
    if (receipt?.status !== "confirmed") process.exitCode = 1;
    return;
  }
  const discovery = env.ENABLE_DISCOVERY === "true" ? scopeSchema.parse(
    JSON.parse(await readFile(new URL("../config/default.json", import.meta.url), "utf8")).discovery_scope,
  ) : undefined;
  const targets = z.array(targetSchema).parse(JSON.parse(env.WATCHLIST) as unknown)
    .map(({ chain, token, pair }) => ({ chain, token: normalizeAddress(chain, token), pair: normalizeAddress(chain, pair) }));
  if (!targets.length && !discovery) throw new Error("Configure a watchlist or enable discovery");
  const uniqueTargets = [...new Map(targets.map((target) => [targetKey(target), target])).values()];
  const equity = new Equity(env.INITIAL_EQUITY_CENTS);

  for (const event of journal) {
    const { position, close, identity } = event;
    if (event.stage === "rug-check" && identity &&
        rugCheckSchema.safeParse(event.detail).data?.verdict === "FAIL") {
      cache.reject(identity);
    } else if (isFill(event.status) && position) {
      positions.record(position);
      const reference=z.object({reference_price_usd:z.number().positive(),reference_at:z.number().int()}).safeParse(event.detail);
      const momentumPolicy=managedPolicy(position.exit_policy);
      if (momentumPolicy) equity.markValue(position,momentumPolicy.initialProceedsCents,position.exit_policy!.entry_at);
      else if (position.paper_costs && reference.success) equity.mark(position,reference.data.reference_price_usd,reference.data.reference_at);
      else equity.mark(position, position.entry_price_usd, Date.parse(event.at));
    } else if (isClose(event.status) && position && close) {
      positions.close(position);
      equity.close(position, close.proceeds_cents, close.exit_at);
    } else if (event.stage === "early_momentum_monitor" && identity) {
      const open=positions.get(identity);
      const mark=z.object({lastProceedsCents:z.number().int().nonnegative(),lastQuoteAt:z.number().int()}).parse(event.detail);
      if (open?.run_id===identity.run_id && managedPolicy(open.exit_policy) && mark.lastQuoteAt>=0) {
        equity.markValue(open,mark.lastProceedsCents,mark.lastQuoteAt);
      }
    } else if (event.stage === "position_mark" && identity) {
      const open = positions.get(identity);
      const point = chartPointSchema.safeParse(event.detail);
      if (open && !managedPolicy(open.exit_policy) && open.run_id === identity.run_id && point.success) equity.mark(open, point.data.price, point.data.t);
    }
  }
  await audit({stage:"worker_replay",status:"ok",gaps:[],detail:{position_keys:positions.list().map(tradeKey).sort()}});
  const live = wallet && wallet.stable && signer
    ? createLiveExecution({...wallet, signer, audit, journal, positions, equity, enabled,entryAllowed: () => !deployment.paused(),exitAllowed: () => controls.liveExitEnabled,onClose:(chain,pnl)=>plane.noteClose(chain,pnl)}) : undefined;
  const abort = new AbortController();
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => { log("info", "worker.shutdown_requested", { reason: signal }); abort.abort(); });
  }
  log("info", "worker.started", { count: uniqueTargets.length });
  await audit({stage:"worker_lifecycle",status:"ok",gaps:[],detail:"running"});
  const options = {
    targets: uniqueTargets, discovery, marks:dexScreenerMarks, intervalMs: env.LOOP_INTERVAL_MS,
    breakerFailures: env.BREAKER_FAILURES, breakerCooldownMs: env.BREAKER_COOLDOWN_MS,
    goPlusAccessToken: await secretText(process.env,"GOPLUS_ACCESS_TOKEN"),
    etherscanApiKey: await secretText(process.env,"ETHERSCAN_API_KEY"),
    social:{x:await secretText(process.env,"X_BEARER_TOKEN"),reddit:await secretText(process.env,"REDDIT_ACCESS_TOKEN"),
      subreddit:process.env.REDDIT_SUBREDDIT},
  };
  const providers=await reasoningProviders(settings,process.env);
  const router=new Router(providers,budget,Date.now,async detail=>{
    await audit({stage:"model_provider",status:detail.ok?"ok":"failed",gaps:[],detail});
  });
  const runtime=new ModeRuntime(plane,providerAgent(router,()=>settings,abort.signal),new StrategyEvidence(process.env.STRATEGY_EVIDENCE_PATH || undefined));
  const shadow=mode==="paper" ? await configuredShadow(process.env,env.AUDIT_PATH,abort.signal) : undefined;
  const momentumPositions=new MomentumPositions(journal,new StrategyEvidence(process.env.STRATEGY_EVIDENCE_PATH || undefined));
  const pipeline = {
    call: runtime.call, mode:runtime, audit, live, deployment, paperCosts, entryDecision, executionMode:mode, momentumPositions,
    shadowCandidate:shadow ? (snapshot: Parameters<typeof shadow.observe>[0],outcome: Parameters<typeof shadow.observe>[1]) => {
      if (!runtime.usesTypedDecisions()) return;
      if (shadow.scope==="early_momentum") {
        if (!runtime.momentumConfig()) return;
        const position=positions.get(snapshot.identity);
        const selected=position?.run_id===snapshot.identity.run_id && position.strategy_id===earlyMomentumId;
        shadow.observe(snapshot,outcome==="filled" && !selected ? "skipped" : outcome,runtime.momentumEvidence(snapshot.identity));
      } else shadow.observe(snapshot,outcome);
    } : undefined,
    entriesBlocked: () => controls.paused,
    exitMode: env.PAPER_EXIT_MODE,
    equityMaxAgeMs: env.MAX_EQUITY_AGE_SEC * 1000,
    riskConfig: async () => {
      const revision = await readRisk(env.RISK_CONFIG_PATH);
      return revision || env.REQUIRE_RISK_CONFIG === "true"
        ? requireFreshRisk(revision, Date.now(), env.MAX_RISK_CONFIG_AGE_SEC * 1000) : defaultRisk;
    },
    equity, positions, maxPositionBps: env.MAX_POSITION_BPS, maxOpenPositions: env.MAX_OPEN_POSITIONS,
  };
  const watcher = watchPositions(positions, equity, audit, abort.signal, pipeline.call, env.MARK_REFRESH_MS, controls.exits, live, async () => (await pipeline.riskConfig()).max_slippage_bps, runtime, () => controls.safety.flattenRequested(), () => controls.exitsPaused,options.marks,momentumPositions).finally(() => abort.abort());
  const refresh = refreshRecon(options, pipeline, cache, abort.signal).finally(() => abort.abort());
  const loop = runLoop(options, pipeline, abort.signal, cache, controls).finally(() => abort.abort());
  const results = await Promise.allSettled([loop, refresh, watcher]);
  await shadow?.settled();
  await audit({stage:"worker_lifecycle",status:"ok",gaps:[],detail:"stopped"});
  for (const result of results) if (result.status === "rejected") throw result.reason;
  log("info", "worker.stopped");
}

await main().catch((error: unknown) => {
  log("error", "worker.failed", { failure_kind: failureKind(error) });
  process.exitCode = 1;
});
