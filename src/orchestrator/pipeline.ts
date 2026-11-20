import { equityCurve } from "../agents/equity-curve.js";
import { executor } from "../agents/executor.js";
import { logger } from "../agents/logger.js";
import { defaultRisk } from "../../schemas/risk-config.js";
import type { RiskConfig } from "../../schemas/risk-config.js";
import type { ExitPolicy } from "../../schemas/exit-policy.js";
import { requireRugCheckPass, rugCheck } from "../agents/rug-check.js";
import { scanner } from "../agents/scanner.js";
import type { LogHop } from "../../schemas/logger.js";
import { riskBudget, sizer } from "../agents/sizer.js";
import type { CallAgent } from "../agents/call.js";
import type { Merged } from "../cache/merge.js";
import type { Audit } from "../logging/logger.js";
import { sizePosition } from "../state/equity.js";
import type { Equity } from "../state/equity.js";
import type { Positions } from "../state/positions.js";
import { failureKind, log } from "../logging/operational.js";
import { CandidateError } from "./errors.js";

export interface Pipeline {
  call: CallAgent;
  audit: Audit;
  equity: Equity;
  positions: Positions;
  maxPositionBps: number;
  maxOpenPositions: number;
  signal?: AbortSignal;
  now?: () => number;
  equityMaxAgeMs?: number;
  riskConfig?: () => Promise<RiskConfig>;
  exitMode?: "profit_only" | "stop_loss";
}

export async function runCandidate(input: Merged, dependencies: Pipeline): Promise<"paper_fill" | "skipped"> {
  const { identity, market, security, expires_at } = input;
  const { audit, call, equity, positions, maxPositionBps, maxOpenPositions, signal, now = Date.now } = dependencies;
  const fresh = () => expires_at !== null && now() < expires_at;
  const fields = { run_id: identity.run_id, chain: identity.chain };
  const record = async (stage: string, detail: unknown) => {
    await audit({ identity, stage, status: "ok", gaps: [], detail });
    log("debug", "pipeline.stage", { ...fields, stage, outcome: "ok" });
  };
  const skip = async (reason: string) => {
    await audit({ identity, stage: "pipeline", status: "skipped", gaps: [...input.gaps, reason] });
    log("info", "pipeline.skipped", { ...fields, reason, gap_count: input.gaps.length + 1 });
    return "skipped" as const;
  };

  if (!market || !security || !fresh()) return skip("mandatory_recon_missing_or_stale");
  const open = positions.get(identity);
  if (open) {
    if (!open.exit_policy) {
      equity.mark(open, market.price_usd, market.provenance?.price_usd.observed_at ?? now());
      await record("equity-mark", { current_equity: equity.current_equity, price_usd: market.price_usd });
    }
    return skip("position_already_open");
  }
  const { vol_1h_usd, created_at_ms, liquidity_usd } = market;
  if (vol_1h_usd === undefined || created_at_ms === undefined || created_at_ms > now()) return skip("scanner_evidence_missing");
  const age_sec = Math.floor((now() - created_at_ms) / 1000);
  const scannerLimits = { min_liquidity_usd: 15_000, min_age_sec: 600, min_vol_1h_usd: 10_000,
    top_n: 20, dedup_window_sec: 3600 };
  const rows = await scanner(call, identity, {
    run_id: identity.run_id,
    feed: [{ chain: identity.chain, token: identity.token, pair: identity.pair,
      trigger: "new_pair", liquidity_usd, vol_1h_usd, age_sec }],
    config: scannerLimits, seen: [], now: Math.floor(now() / 1000),
  });
  await record("scanner", rows);
  const scan = rows.find(row => !row.skipped);
  if (!scan || liquidity_usd < scannerLimits.min_liquidity_usd || age_sec < scannerLimits.min_age_sec ||
      vol_1h_usd < scannerLimits.min_vol_1h_usd) return skip("scanner_rejected");

  const checks_raw = security.checks_raw ?? {};
  const risk = await rugCheck(call, identity, { ...scan, checks_raw });
  await record("rug-check", risk);
  let pass;
  try { pass = requireRugCheckPass(security.assessment, risk, checks_raw, age_sec); }
  catch (error) {
    if (!(error instanceof CandidateError)) throw error;
    return skip("risk_not_clear");
  }
  const config = await dependencies.riskConfig?.() ?? defaultRisk;
  if (dependencies.equityMaxAgeMs && !equity.hasFreshMarks(positions.list(), now(), dependencies.equityMaxAgeMs)) {
    return skip("equity_marks_stale");
  }
  const currentEquity = equity.current_equity;
  const availableCents = equity.availableCapital - positions.committedCents;
  if (availableCents <= 0 || positions.count >= maxOpenPositions) {
    return skip("position_limit");
  }
  const budget = riskBudget(config, equity.drawdown_pct, currentEquity, market.liquidity_usd);
  // The paper quote has no execution costs or price-impact estimate.
  const decisionAt = Math.floor(now() / 1000);
  const proposal = await sizer(call, identity, {
    rug: pass,
    equity: { equity_usd: currentEquity / 100, drawdown_pct: equity.drawdown_pct,
      as_of: Math.floor(equity.oldestMarkAt(positions.list(), now()) / 1000) },
    market: { liquidity_usd, volatility_pct: 0, gas_usd: 0, reference_price: market.price_usd },
    config: { max_risk_pct_per_trade: config.max_risk_pct_per_trade,
      max_position_vs_pool_depth: config.max_position_vs_pool_depth, max_slippage_bps: config.max_slippage_bps,
      halt_new_entries_dd: config.halt_new_entries_dd, max_equity_age_sec: (dependencies.equityMaxAgeMs ?? 60_000) / 1000 },
    now: decisionAt,
  });
  if (proposal.status !== "SIZED") {
    await record("sizer", proposal);
    return skip(proposal.status === "HALTED" ? "sizer_halted" : "sizer_refused");
  }
  const costCents = sizePosition(Math.floor(Math.min(proposal.size_usd, availableCents / 100) * 100), currentEquity, Math.min(availableCents, budget), maxPositionBps);
  await record("sizer", { proposal, approved_cents: costCents });
  if (costCents === 0) return skip("zero_size");

  const exitBase = { entry_price: market.price_usd, entry_at: now(), min_profit_bps_for_exit: 25,
    timeout_ladder: config.timeout_ladder, max_hold_sec: 3600 };
  const exit_policy: ExitPolicy = dependencies.exitMode === "stop_loss"
    ? { ...exitBase, mode: "stop_loss", stop_loss_bps: 100 }
    : { ...exitBase, mode: "profit_only" };
  const recommendation = await executor(call, identity, { action: "entry", position: null,
    sizer: { status: proposal.status, size_usd: costCents / 100, max_slippage_bps: config.max_slippage_bps },
    market: { quote_price: market.price_usd, expected_slippage_bps: 0, gas_usd: 0, now: Math.floor(now() / 1000) } });
  await record("executor", recommendation);
  if (recommendation.action !== "entry" || recommendation.status !== "FILLED" ||
      recommendation.fill_price !== market.price_usd || recommendation.size_usd !== costCents / 100 ||
      recommendation.slippage_bps !== 0 || recommendation.gas_usd !== 0 || recommendation.tx_hash !== "sim") {
    return skip("executor_rejected");
  }
  if (!fresh() || signal?.aborted) return skip("expired_before_fill");

  const position = { ...identity, cost_cents: costCents, entry_price_usd: market.price_usd,
    ...(dependencies.exitMode ? { exit_policy: { ...exit_policy, entry_at: now() } } : {}) };
  await audit({ identity, stage: "executor", status: "paper_fill", gaps: [], position });
  positions.record(position);
  log("info", "position.opened", { ...fields, outcome: "paper_fill" });
  equity.mark(position, market.price_usd, market.provenance?.price_usd.observed_at ?? now());

  const hops: LogHop[] = [
    { agent: "scanner", output: scan }, { agent: "rug", output: risk },
    { agent: "sizer", output: proposal }, { agent: "executor", output: recommendation },
  ];
  try {
    const projection = await equityCurve(call, identity, {
      starting_equity_usd: equity.initialCents / 100,
      closed_trades: equity.closedTrades(),
      as_of: Math.floor(now() / 1000),
    });
    hops.push({ agent: "equity", output: projection });
    await record("equity-curve", projection);
  } catch (error) {
    log("warn", "pipeline.observer_failed", { ...fields, stage: "equity-curve", failure_kind: failureKind(error) });
    await audit({ identity, stage: "equity-curve", status: "failed", gaps: ["equity-curve_unavailable"] });
  }
  try {
    const trace = await logger(call, identity, hops);
    const gaps = [...new Set([
      ...(!input.social || input.social.sentiment === "unavailable" ? ["social_unavailable"] : []),
      ...trace.rows.flatMap(row => row.gaps),
    ])];
    await audit({ identity, stage: "logger", status: "ok", detail: trace, gaps });
    log("debug", "pipeline.stage", { ...fields, stage: "logger", outcome: "ok", gap_count: gaps.length });
  } catch (error) {
    log("warn", "pipeline.observer_failed", { ...fields, stage: "logger", failure_kind: failureKind(error) });
    await audit({ identity, stage: "logger", status: "failed", gaps: ["logger_unavailable"] });
  }
  return "paper_fill";
}
