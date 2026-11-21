import type { ExecutorInput } from "../../schemas/executor.js";
import type { SigningRequest } from "../exec/signer.js";
import { log, withLogContext } from "../logging/operational.js";
import { CandidateError } from "../orchestrator/errors.js";
import { evmChainIds } from "../tools/goplus.js";
import type { Handoff } from "../../schemas/common.js";
import { executorInput, executorSchema } from "../../schemas/executor.js";
import { matchesIdentity } from "./call.js";
import type { CallAgent } from "./call.js";

export function executor(call: CallAgent, identity: Handoff, data: ExecutorInput) {
  if (data.market?.quote_price == null) throw new CandidateError("ERROR: missing quote_price");
  const input = executorInput.parse({ ...identity, ...data });
  const { position, market, sizer } = input;
  if (input.action === "exit" && !position) throw new CandidateError("ERROR: missing exit position");
  const move = position ? ((market.quote_price - position.entry_price) * 10000) / position.entry_price : 0;
  const triggered =
    input.action === "entry" ||
    (position &&
      (move <= -position.stop_loss_bps ||
        move >= position.take_profit_bps ||
        market.now - position.opened_at >= position.max_hold_sec));
  const reason =
    sizer.status !== "SIZED"
      ? sizer.status
      : !triggered
        ? "no_exit_trigger"
        : market.expected_slippage_bps > sizer.max_slippage_bps
          ? "slippage_above_max"
          : null;
  return call({
    prompt: "executor",
    schema: executorSchema,
    identity,
    data: input,
    validate: (out) =>
      matchesIdentity(out, identity) &&
      out.action === input.action &&
      (reason
        ? out.status === (reason === "slippage_above_max" ? "ABORTED" : "SKIPPED") && out.reason === reason
        : out.status === "FILLED" && out.fill_price === market.quote_price && out.size_usd === sizer.size_usd),
  });
}

/**
 * Offline signing boundary for a future live adapter. Callers supply a code-built,
 * locally validated transaction and wallet. Model output can only veto signing.
 */
export async function signApprovedTransaction(
  recommendation: Handoff & { decision: "approve" | "skip"; reason?: string },
  expiresAt: number,
  request: SigningRequest,
) {
  if (recommendation.decision !== "approve" || !Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
    log("warn", "signer.rejected", { run_id: recommendation.run_id, reason: "approval_missing_or_expired" });
    throw new CandidateError("Approval missing or expired before signing");
  }
  const chain = recommendation.chain;
  const matchesChain =
    request.chain === "solana"
      ? chain === "solana"
      : chain !== "solana" && request.transaction.chainId === evmChainIds[chain];
  if (!matchesChain) {
    log("warn", "signer.rejected", { run_id: recommendation.run_id, reason: "chain_mismatch" });
    throw new CandidateError("Signing request chain differs from approval");
  }
  const { signTransaction } = await import("../exec/signer.js");
  return withLogContext({ run_id: recommendation.run_id }, () => signTransaction(request));
}
