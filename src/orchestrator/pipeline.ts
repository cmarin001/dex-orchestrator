import { equityCurve } from "../agents/equity-curve.js";
import { executor } from "../agents/executor.js";
import { logger } from "../agents/logger.js";
import { defaultRisk } from "../../schemas/risk-config.js";
import type { RiskConfig } from "../../schemas/risk-config.js";
import type { ExitPolicy } from "../../schemas/exit-policy.js";
import { requireRugCheckPass, rugCheck } from "../agents/rug-check.js";
import { scanner } from "../agents/scanner.js";
import { riskBudget, sizer } from "../agents/sizer.js";
import type { CallAgent } from "../agents/call.js";
import type { Merged } from "../cache/merge.js";
import type { Audit } from "../logging/logger.js";
import { sizePosition } from "../state/equity.js";
import type { Equity } from "../state/equity.js";
import type { Positions } from "../state/positions.js";
import { CandidateError, SystemError } from "./errors.js";

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
  const record = (stage: string, detail: unknown) => audit({ identity, stage, status: "ok", gaps: [], detail });
  const skip = async (reason: string) => {
    await audit({ identity, stage: "pipeline", status: "skipped", gaps: [...input.gaps, reason] });
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
  const scan = await scanner(call, identity, input);
  await record("scanner", scan);
  if (scan.decision !== "advance" || market.liquidity_usd <= 0) return skip("scanner_rejected");

  const risk = await rugCheck(call, identity, { security, scan });
  await record("rug-check", risk);
  if (security.assessment !== "clear" || risk.assessment !== "clear") return skip("risk_not_clear");

  const pass = requireRugCheckPass(security.assessment, risk);
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
  const proposal = await sizer(call, identity, {
    market, risk: pass, available_cents: Math.min(availableCents, budget), current_equity: currentEquity, max_position_bps: maxPositionBps,
  });
  const costCents = sizePosition(proposal.requested_cents, currentEquity, Math.min(availableCents, budget), maxPositionBps);
  await record("sizer", { proposal, approved_cents: costCents });
  if (costCents === 0) return skip("zero_size");

  const exitBase = { entry_price: market.price_usd, entry_at: now(), min_profit_bps_for_exit: 25,
    timeout_ladder: config.timeout_ladder, max_hold_sec: 3600 };
  const exit_policy: ExitPolicy = dependencies.exitMode === "stop_loss"
    ? { ...exitBase, mode: "stop_loss", stop_loss_bps: 100 }
    : { ...exitBase, mode: "profit_only" };
  const recommendation = await executor(call, identity, { mode: "paper", cost_cents: costCents, market, risk, exit_policy,
    max_slippage_bps: config.max_slippage_bps });
  await record("executor", recommendation);
  if (recommendation.decision !== "approve") return skip("executor_rejected");
  if (!fresh() || signal?.aborted) return skip("expired_before_fill");

  const position = { ...identity, cost_cents: costCents, entry_price_usd: market.price_usd,
    ...(dependencies.exitMode ? { exit_policy: { ...exit_policy, entry_at: now() } } : {}) };
  await audit({ identity, stage: "executor", status: "paper_fill", gaps: [], position });
  positions.record(position);
  equity.mark(position, market.price_usd, market.provenance?.price_usd.observed_at ?? now());

  let observerError: unknown;
  const socialGaps = !input.social || input.social.sentiment === "unavailable" ? ["social_unavailable"] : [];
  const observers = {
    logger: () => logger(call, identity, { position, gaps: socialGaps }),
    "equity-curve": () => equityCurve(call, identity, {
      current_equity: equity.current_equity,
      committed_cents: positions.committedCents,
    }),
  };
  for (const [stage, observe] of Object.entries(observers)) {
    let result;
    try {
      result = await observe();
    } catch (error) {
      if (!(error instanceof SystemError || error instanceof CandidateError)) throw error;
      await audit({ identity, stage, status: "failed", gaps: [stage + "_unavailable"] });
      if (error instanceof SystemError) observerError = error;
      continue;
    }
    const gaps = "gaps" in result ? [...new Set([...socialGaps, ...result.gaps])] : [];
    await audit({ identity, stage, status: "ok", detail: result, gaps });
  }
  if (observerError) throw observerError;
  return "paper_fill";
}
