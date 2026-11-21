export type { TransactionIntent, WalletChain } from "../../schemas/transaction-intent.js";
export type { TxReceipt, TxResult, SimulationResult } from "../../schemas/tx-result.js";

/** Bytes stay inside the wallet and are never serialized into the journal. */
export interface SignedTx {
  id: string;
  bytes: Uint8Array;
  expires_at_height?: number;
}
