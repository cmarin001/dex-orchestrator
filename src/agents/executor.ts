import type { z } from "zod";
import { signTransaction } from "../exec/signer.js";
import type { SigningRequest } from "../exec/signer.js";
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
    throw new CandidateError("Approval missing or expired before signing");
  }
  const chain = recommendation.chain;
  const matchesChain = request.chain === "solana"
    ? chain === "solana"
    : chain !== "solana" && request.transaction.chainId === evmChainIds[chain];
  if (!matchesChain) throw new CandidateError("Signing request chain differs from approval");
  return signTransaction(request);
}
