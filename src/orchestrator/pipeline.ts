import { equityCurve } from "../agents/equity-curve.js";
import { executor } from "../agents/executor.js";
import { logger } from "../agents/logger.js";
import { rugCheck } from "../agents/rug-check.js";
import { scanner } from "../agents/scanner.js";
import { sizer } from "../agents/sizer.js";
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
    equity.mark(open, market.price_usd);
    await record("equity-mark", { current_equity: equity.current_equity, price_usd: market.price_usd });
    return skip("position_already_open");
  }
  const scan = await scanner(call, identity, input);
  await record("scanner", scan);
  if (scan.decision !== "advance" || market.liquidity_usd <= 0) return skip("scanner_rejected");

  const risk = await rugCheck(call, identity, { security, scan });
  await record("rug-check", risk);
  if (security.assessment !== "clear" || risk.assessment !== "clear") return skip("risk_not_clear");

  const currentEquity = equity.current_equity;
  const availableCents = equity.initialCents - positions.committedCents;
  if (availableCents <= 0 || positions.count >= maxOpenPositions) {
    return skip("position_limit");
  }
  const proposal = await sizer(call, identity, {
    market, risk, available_cents: availableCents, current_equity: currentEquity, max_position_bps: maxPositionBps,
  });
  const costCents = sizePosition(proposal.requested_cents, currentEquity, availableCents, maxPositionBps);
  await record("sizer", { proposal, approved_cents: costCents });
  if (costCents === 0) return skip("zero_size");

  const recommendation = await executor(call, identity, { mode: "paper", cost_cents: costCents, market, risk });
  await record("executor", recommendation);
  if (recommendation.decision !== "approve") return skip("executor_rejected");
  if (!fresh() || signal?.aborted) return skip("expired_before_fill");

  const position = { ...identity, cost_cents: costCents, entry_price_usd: market.price_usd };
  await audit({ identity, stage: "executor", status: "paper_fill", gaps: [], position });
  positions.record(position);

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
