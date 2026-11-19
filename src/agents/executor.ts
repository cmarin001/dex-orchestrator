import type { z } from "zod";
import type { SigningRequest } from "../exec/signer.js";
import { log, withLogContext } from "../logging/operational.js";
import { CandidateError } from "../orchestrator/errors.js";
import { evmChainIds } from "../tools/goplus.js";
import type { Handoff } from "../../schemas/common.js";
import { executorSchema } from "../../schemas/executor.js";
import type { CallAgent } from "./call.js";

export const executor = (call: CallAgent, identity: Handoff, data: unknown) =>
  call({ prompt: "executor", schema: executorSchema, identity, data });

/**
 * Offline signing boundary for a future live adapter. Callers supply a code-built,
 * locally validated transaction and wallet. Model output can only veto signing.
 */
export async function signApprovedTransaction(
  recommendation: z.infer<typeof executorSchema>, expiresAt: number, request: SigningRequest,
) {
  if (recommendation.decision !== "approve" || !Number.isFinite(expiresAt) || Date.now() >= expiresAt) {
    log("warn", "signer.rejected", { run_id: recommendation.run_id, reason: "approval_missing_or_expired" });
    throw new CandidateError("Approval missing or expired before signing");
  }
  const chain = recommendation.chain;
  const matchesChain = request.chain === "solana"
    ? chain === "solana"
    : chain !== "solana" && request.transaction.chainId === evmChainIds[chain];
  if (!matchesChain) {
    log("warn", "signer.rejected", { run_id: recommendation.run_id, reason: "chain_mismatch" });
    throw new CandidateError("Signing request chain differs from approval");
  }
  const { signTransaction } = await import("../exec/signer.js");
  return withLogContext({ run_id: recommendation.run_id }, () => signTransaction(request));
}
