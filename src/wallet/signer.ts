import { createHash } from "node:crypto";
import { z } from "zod";
import { transactionIntentSchema } from "../../schemas/transaction-intent.js";
import { txReceiptSchema } from "../../schemas/tx-result.js";
import type { WalletConfig } from "../../schemas/wallet-config.js";
import type { Audit } from "../logging/logger.js";
import type { JournalEvent } from "../logging/types.js";
import type { SignedTx, SimulationResult, TransactionIntent, TxReceipt, WalletChain } from "./types.js";
import { reserveSpend } from "./limits.js";
import { requireSimulation } from "./simulate.js";
import { broadcastSigned } from "./broadcast.js";
import { confirm } from "./confirm.js";

export interface Signer {
  chain: WalletChain;
  address(): Promise<string>;
  simulate(intent: TransactionIntent): Promise<SimulationResult>;
  signAndSend(intent: TransactionIntent): Promise<TxReceipt>;
  reconcile(intent: TransactionIntent): Promise<TxReceipt | null>;
}

type Prepared = { simulation: SimulationResult; sign: () => Promise<SignedTx> };

export interface ChainAdapter {
  chain: WalletChain;
  address(): Promise<string>;
  prepare(intent: TransactionIntent): Promise<Prepared>;
  replace?(intent: TransactionIntent, identifier: Identifier): Promise<Prepared | null>;
  broadcast(bytes: Uint8Array): Promise<string>;
  receipt(intent: TransactionIntent, identifier: Identifier): Promise<TxReceipt>;
}

const identifierSchema = z.strictObject({ id:z.string().min(1), expires_at_height:z.number().int().positive().optional() });
type Identifier = z.infer<typeof identifierSchema>;
const journalSchema = z.discriminatedUnion("event", [
  z.strictObject({ event:z.literal("reserve"), hash:z.string(), intent:transactionIntentSchema, at:z.number() }),
  z.strictObject({ event:z.literal("release"), run_id:z.string() }),
  z.strictObject({ event:z.literal("signed"), run_id:z.string(), identifier:identifierSchema }),
  z.strictObject({ event:z.literal("receipt"), run_id:z.string(), receipt:txReceiptSchema }),
]);
type WalletEvent = z.infer<typeof journalSchema>;
type Reservation = { hash:string; intent:TransactionIntent; reserved_at:number; attempts:Identifier[]; receipt?:TxReceipt };

export function createSigner(adapter: ChainAdapter, caps: WalletConfig, audit: Audit, journal: JournalEvent[],
  poll: typeof confirm = confirm): Signer {
  if (adapter.chain !== caps.chain) throw new Error("WALLET_CHAIN_MISMATCH");
  const reservations = new Map<string,Reservation>();
  function apply(row: WalletEvent) {
    if (row.event === "reserve") {
      reservations.set(row.intent.run_id,{hash:row.hash,intent:row.intent,reserved_at:row.at,attempts:[]});
      return;
    }
    const record = reservations.get(row.run_id);
    if (!record) throw new Error("WALLET_JOURNAL_INVALID");
    if (row.event === "release") {
      if (record.attempts.length) throw new Error("WALLET_JOURNAL_INVALID");
      reservations.delete(row.run_id);
      return;
    }
    if (row.event === "signed") { record.attempts.push(row.identifier); record.receipt = undefined; }
    else record.receipt = row.receipt;
  }
  for (const row of journal) if (row.stage === "wallet") apply(journalSchema.parse(row.detail));
  async function record(row: WalletEvent) {
    await audit({stage:"wallet",status:"ok",gaps:[],detail:row});
    apply(row);
  }
  let queue = Promise.resolve();
  const parse = (raw: TransactionIntent) => {
    const intent = transactionIntentSchema.parse(raw);
    if (intent.chain !== adapter.chain) {
      throw new Error("WALLET_POLICY_MISMATCH");
    }
    return intent;
  };
  async function execute(raw: TransactionIntent, recoverOnly: boolean): Promise<TxReceipt | null> {
    const intent = parse(raw);
    const hash = createHash("sha256").update(JSON.stringify(intent)).digest("hex");
    const run_id = intent.run_id;
    const pending = (tx_hash: string): TxReceipt => ({chain:intent.chain,tx_hash,status:"pending"});
    const prior = reservations.get(run_id);
    if (prior && prior.hash !== hash) throw new Error("INTENT_CONFLICT");
    if (prior?.receipt && prior.receipt.status !== "replaced") return prior.receipt;
    const attempts = prior?.attempts ?? [];
    const latest = attempts.at(-1);
    async function reconcile() {
      const recent = attempts.at(-1)!;
      const receipt = await poll(async () => {
        let current = pending(recent.id);
        for (const attempt of attempts) {
          let result: TxReceipt;
          try { result = txReceiptSchema.parse(await adapter.receipt(intent,attempt)); }
          catch { result = pending(attempt.id); }
          if (result.tx_hash !== attempt.id || result.chain !== intent.chain) throw new Error("RECEIPT_MISMATCH");
          if (result.status === "confirmed" || result.status === "failed") return result;
          if (attempt.id === recent.id) current = result;
        }
        return current;
      });
      if (receipt.status !== "pending") await record({event:"receipt",run_id,receipt});
      return receipt;
    }
    const alreadyReconciled = prior?.receipt !== undefined;
    const known = latest && !prior?.receipt ? await reconcile() : prior?.receipt;
    if (known?.status === "replaced" && !alreadyReconciled) return known;
    if (known && known.status !== "pending" && known.status !== "replaced") return known;
    if (recoverOnly) {
      if (prior && !latest) await record({event:"release",run_id});
      return known ?? null;
    }
    const now = Date.now();
    const replacement = known?.status === "pending" && latest;
    if (replacement && (!adapter.replace || attempts.length >= 2 || now >= intent.deadline_sec * 1000)) return known!;
    if (BigInt(intent.max_fee_native) > BigInt(caps.max_fee_native)) throw new Error("FEE_LIMIT_EXCEEDED");
    if (now >= intent.deadline_sec * 1000) throw new Error("INTENT_EXPIRED");
    const otherReservations = [...reservations.values()].filter(item => item.intent.run_id !== run_id);
    if (otherReservations.some(item => item.attempts.length && !item.receipt)) throw new Error("UNRECONCILED_TRANSACTION");
    reserveSpend(intent,otherReservations.map(item => ({...item,pending:!item.receipt})),caps,now);
    if (!prior) await record({event:"reserve",intent,hash,at:now});
    const active = reservations.get(run_id)!.attempts;
    async function send(prepared: Prepared) {
      requireSimulation(intent, prepared.simulation);
      await audit({stage:"wallet_simulation",status:"ok",gaps:[],detail:{run_id,simulation:prepared.simulation}});
      if (Date.now() >= intent.deadline_sec * 1000) throw new Error("INTENT_EXPIRED");
      const signed = await prepared.sign();
      if (Date.now() >= intent.deadline_sec * 1000) throw new Error("INTENT_EXPIRED");
      const identifier = identifierSchema.parse({id:signed.id,expires_at_height:signed.expires_at_height});
      if (active.some(attempt => attempt.id === identifier.id)) throw new Error("DUPLICATE_REPLACEMENT");
      await record({event:"signed",run_id,identifier});
      await broadcastSigned(signed, bytes => adapter.broadcast(bytes));
    }
    try {
      const prepared = replacement ? await adapter.replace!(intent,replacement) : await adapter.prepare(intent);
      if (!prepared) return known!;
      await send(prepared);
    } catch (error) {
      if (active.length === 0) await record({event:"release",run_id});
      throw error;
    }
    // Resolve through the journal's live list, including every replacement.
    if (!prior) return execute(intent,true);
    return reconcile();
  }
  return {
    chain: adapter.chain,
    address: () => adapter.address(),
    simulate: async intent => (await adapter.prepare(parse(intent))).simulation,
    reconcile(intent) { return enqueue(intent,true); },
    async signAndSend(intent) { return (await enqueue(intent,false))!; },
  };
  function enqueue(intent: TransactionIntent, recoverOnly: boolean) {
    const result = queue.then(async () => {
      const initial = !reservations.get(intent.run_id)?.attempts.length;
      const receipt = await execute(intent,recoverOnly);
      if (recoverOnly || !initial || !adapter.replace || receipt?.status !== "pending") return receipt;
      try { return await execute(intent,false); }
      catch (error) {
        if (error instanceof Error && ["FEE_LIMIT_EXCEEDED","INTENT_EXPIRED",
          "DAILY_LIMIT_EXCEEDED","PER_TRADE_LIMIT_EXCEEDED","BITCOIN_MEMPOOL_REJECTED"].includes(error.message)) return receipt;
        throw error;
      }
    });
    queue = result.then(() => undefined, () => undefined);
    return result;
  }
}
