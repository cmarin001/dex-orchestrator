import { Keypair, VersionedTransaction } from "@solana/web3.js";
import type { Hex, TransactionSerializable } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export type SigningRequest =
  | { chain: "evm"; transaction: TransactionSerializable; privateKey: Hex }
  | { chain: "solana"; transaction: VersionedTransaction; secretKey: Uint8Array };

/** The trusted execution adapter supplies a fully built, locally validated transaction. */
export async function signTransaction(request: SigningRequest): Promise<Uint8Array> {
  if (request.chain === "evm") {
    const signed = await privateKeyToAccount(request.privateKey).signTransaction(request.transaction);
    return Buffer.from(signed.slice(2), "hex");
  }
  const transaction = VersionedTransaction.deserialize(request.transaction.serialize());
  transaction.sign([Keypair.fromSecretKey(request.secretKey)]);
  return transaction.serialize();
}
