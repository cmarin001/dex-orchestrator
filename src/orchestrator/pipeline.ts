import type { ScannerRow } from "../../schemas/scanner.js";
import { equityCurve } from "../agents/equity-curve.js";
import { executor } from "../agents/executor.js";
import { logger } from "../agents/logger.js";
import { defaultRisk } from "../../schemas/risk-config.js";
import type { RiskConfig } from "../../schemas/risk-config.js";
import type { ExitPolicy } from "../../schemas/exit-policy.js";
import { rugCheck, requireRugCheckPass } from "../agents/rug-check.js";
import { scanner } from "../agents/scanner.js";
import type { LogHop } from "../../schemas/logger.js";
import { riskBudget, sizer } from "../agents/sizer.js";
import type { CallAgent } from "../agents/call.js";
import type { Merged } from "../cache/merge.js";
import type { Audit } from "../logging/logger.js";
import { sizePosition } from "../state/equity.js";
import type { Equity } from "../state/equity.js";
import type { Positions } from "../state/positions.js";
import type { LiveExecution } from "../wallet/live.js";
import { failureKind, log } from "../logging/operational.js";
import { CandidateError } from "./errors.js";

export const scannerLimits = { min_liquidity_usd: 15_000, min_age_sec: 600, min_vol_1h_usd: 10_000,
  top_n: 20, dedup_window_sec: 3600 };

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
  rejectRecon?: (target: Merged["identity"]) => void;
  exitMode?: "profit_only" | "stop_loss";
  live?: LiveExecution;
}

export async function runCandidate(input: Merged, dependencies: Pipeline, ranked?: ScannerRow): Promise<"paper_fill" | "live_fill" | "skipped"> {
  const { identity, feed_entry, quote, expires_at } = input;
  const { audit, call, equity, positions, maxPositionBps, maxOpenPositions, signal, now = Date.now } = dependencies;
  const fresh = () => expires_at !== null && now() <= expires_at;
  const fields = { run_id: identity.run_id, chain: identity.chain };
  const record = async (stage: string, detail: unknown) => {
    await audit({ identity, stage, status: "ok", gaps: [], detail });
    log("debug", "pipeline.stage", { ...fields, stage, outcome: "ok" });
  };
  const skip = async (reason: string) => {
    await audit({ identity, stage: "pipeline", status: "skipped", gaps: [...new Set([...input.gaps, reason])] });
    log("info", "pipeline.skipped", { ...fields, reason, gap_count: new Set([...input.gaps, reason]).size });
    return "skipped" as const;
  };

  if (!feed_entry || !quote || !fresh()) {
    const reason = input.gap ?? "stale_recon";
    await audit({ identity, stage: "scanner", status: "skipped", gaps: [reason],
      detail: [{ ...identity, skipped: true, reason }] });
    return skip(reason);
  }
  if (dependencies.live && identity.chain !== dependencies.live.chain) return skip("live_chain_disabled");
  const open = positions.get(identity);
  if (open) {
    if (!open.exit_policy) {
      equity.mark(open, quote.value, quote.fetched_at);
      await record("equity-mark", { marked_capital_cents: equity.markedCapitalCents, price_usd: quote.value });
    }
    return skip("position_already_open");
  }
  const { vol_1h_usd, liquidity_usd, age_sec } = feed_entry;

  const rows = ranked ? [ranked] : await scanner(call, identity, {
    run_id: identity.run_id,
    feed: [{ chain: identity.chain, token: identity.token, pair: identity.pair, trigger: feed_entry.trigger, liquidity_usd, vol_1h_usd, age_sec }],
    config: scannerLimits, seen: [],
  });
  await record("scanner", rows);
  const scan = rows.find(row => !row.skipped);
  if (!scan || liquidity_usd < scannerLimits.min_liquidity_usd || age_sec < scannerLimits.min_age_sec ||
      vol_1h_usd < scannerLimits.min_vol_1h_usd) return skip("scanner_rejected");

  if (!fresh()) return skip("stale_recon");
  const { checks_raw, assessment, sources_disagree, provenance } = input;
  if (sources_disagree) return skip("critical_source_conflict");
  const risk = await rugCheck(call, identity, { ...scan, checks_raw });
  await record("rug-check", risk);
  if (risk.verdict === "FAIL") dependencies.rejectRecon?.(identity);
  let pass;
  try { pass = requireRugCheckPass(assessment, risk, checks_raw, age_sec); }
  catch (error) {
    if (!(error instanceof CandidateError)) throw error;
    return skip("risk_not_clear");
  }
  const config = await dependencies.riskConfig?.() ?? defaultRisk;
  if (dependencies.equityMaxAgeMs && !equity.hasFreshMarks(positions.list(), now(), dependencies.equityMaxAgeMs)) {
    return skip("equity_marks_stale");
  }
  const account = await equityCurve(call, identity, { starting_equity_usd: equity.initialCents / 100,
    closed_trades: equity.closedTrades(), as_of: Math.floor(now() / 1000) }, now);
  await record("equity-curve", account);
  const currentEquity = Math.round(account.equity_usd * 100);
  const availableCents = equity.availableCapital - positions.committedCents;
  if (availableCents <= 0 || positions.count >= maxOpenPositions) {
    return skip("position_limit");
  }

  // The paper quote has no execution costs or price-impact estimate.
  const proposal = await sizer(call, identity, {
    rug: {verdict:pass.verdict},
    equity: { equity_usd: account.equity_usd, drawdown_pct: account.drawdown_pct, as_of: account.as_of },
    market: { liquidity_usd: scan.liquidity_usd, volatility_pct: 0, gas_usd: 0, reference_price: quote.value },
    config: { max_risk_pct_per_trade: config.max_risk_pct_per_trade,
      max_position_vs_pool_depth: config.max_position_vs_pool_depth, max_slippage_bps: config.max_slippage_bps,
      halt_new_entries_dd: config.halt_new_entries_dd, max_equity_age_sec: (dependencies.equityMaxAgeMs ?? 60_000) / 1000 },
  }, now);
  if (proposal.status !== "SIZED") {
    await record("sizer", proposal);
    return skip(proposal.status === "HALTED" ? "sizer_halted" : "sizer_refused");
  }
  const capacity = equity.entryCapacityCents(positions.committedCents, config.halt_new_entries_dd);
  if (!capacity) return skip("portfolio_loss_budget_exhausted");
  const budget = riskBudget(config, equity.drawdown_pct, currentEquity, scan.liquidity_usd);
  const costCents = sizePosition(Math.floor(Math.min(proposal.size_usd, availableCents / 100) * 100), currentEquity, Math.min(capacity, budget, dependencies.live?.perTradeCents ?? Infinity), maxPositionBps);
  await record("sizer", { proposal, approved_cents: costCents, portfolio_capacity_cents: capacity });
  if (costCents === 0) return skip("zero_size");

  const exitBase = { entry_price: quote.value, entry_at: now(), min_profit_bps_for_exit: 25,
    timeout_ladder: config.timeout_ladder, max_hold_sec: 3600 };
  const exit_policy: ExitPolicy = dependencies.exitMode === "stop_loss"
    ? { ...exitBase, mode: "stop_loss", stop_loss_bps: 100 }
    : { ...exitBase, mode: "profit_only" };
  const recommendation = await executor(call, identity, { action: "entry", position: null,
    sizer: { status: proposal.status, size_usd: costCents / 100, max_slippage_bps: config.max_slippage_bps },
    market: { quote_price: quote.value, expected_slippage_bps: input.expected_slippage_bps, gas_usd: 0, now: Math.floor(now() / 1000) } });
  await record("executor", recommendation);
  if (recommendation.action !== "entry" || recommendation.status !== "FILLED" ||
      recommendation.fill_price !== quote.value || recommendation.size_usd !== costCents / 100 ||
      recommendation.slippage_bps !== input.expected_slippage_bps || recommendation.gas_usd !== 0 || !recommendation.tx_hash) {
    return skip("executor_rejected");
  }
  const latest = await dependencies.riskConfig?.() ?? config;
  if (!equity.hasFreshMarks(positions.list(), now(), dependencies.equityMaxAgeMs ?? 60_000)) {
    return skip("equity_marks_stale");
  }
  const remaining = equity.entryCapacityCents(positions.committedCents, latest.halt_new_entries_dd);
  const latestBudget = riskBudget(latest, equity.drawdown_pct, equity.markedCapitalCents, scan.liquidity_usd);
  if (positions.get(identity) || positions.count >= maxOpenPositions ||
      sizePosition(costCents, equity.markedCapitalCents, Math.min(remaining, latestBudget), maxPositionBps) < costCents) {
    return skip("entry_limit_changed");
  }
  if (!fresh() || signal?.aborted) return skip("expired_before_fill");

  const position = { ...identity, cost_cents: costCents, entry_price_usd: quote.value,
    ...(dependencies.exitMode ? { exit_policy: { ...exit_policy, entry_at: now() } } : {}) };
  let outcome: "live_fill" | "paper_fill" | "skipped";
  if (dependencies.live) {
    const confirmed = await dependencies.live.enter(identity,costCents,quote.value,
      Math.min(latest.max_slippage_bps,config.max_slippage_bps),exit_policy,expires_at!);
    outcome = confirmed ? "live_fill" : await skip("live_entry_unconfirmed");
  } else {
    await audit({ identity, stage: "executor", status: "paper_fill", gaps: [], position });
    positions.record(position);
    log("info", "position.opened", { ...fields, outcome: "paper_fill" });
    equity.mark(position, quote.value, quote.fetched_at);
    outcome = "paper_fill";
  }

  const hops: LogHop[] = [
    { agent: "scanner", output: scan }, { agent: "rug", output: risk },
    { agent: "sizer", output: proposal }, { agent: "executor", output: recommendation },
  ];
  hops.push({ agent: "equity", output: account });
  try {
    const trace = await logger(call, identity, hops);
    const gaps = [...new Set([
      ...(feed_entry.social_score === null ? ["social_unavailable"] : []),
      ...trace.rows.flatMap(row => row.gaps),
    ])];
    await audit({ identity, stage: "logger", status: "ok", detail: trace, gaps });
    log("debug", "pipeline.stage", { ...fields, stage: "logger", outcome: "ok", gap_count: gaps.length });
  } catch (error) {
    log("warn", "pipeline.observer_failed", { ...fields, stage: "logger", failure_kind: failureKind(error) });
    await audit({ identity, stage: "logger", status: "failed", gaps: ["logger_unavailable"] });
  }
  try {
    const projection = await equityCurve(call, identity, {
      starting_equity_usd: equity.initialCents / 100,
      closed_trades: equity.closedTrades(),
      as_of: Math.floor(now() / 1000),
    });
    await record("equity-curve", projection);
  } catch (error) {
    log("warn", "pipeline.observer_failed", { ...fields, stage: "equity-curve", failure_kind: failureKind(error) });
    await audit({ identity, stage: "equity-curve", status: "failed", gaps: ["equity-curve_unavailable"] });
  }
  return outcome;
}
