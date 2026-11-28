import { createHash } from "node:crypto";
import { z } from "zod";
import { transactionIntentSchema } from "../../schemas/transaction-intent.js";
import { txReceiptSchema } from "../../schemas/tx-result.js";
import type { WalletConfig } from "../../schemas/wallet-config.js";
import type { Audit } from "../logging/logger.js";
import type { JournalEvent } from "../logging/types.js";
import type { SafetyState } from "../control/safety.js";
import type { SignedTx, SimulationResult, TransactionIntent, TxReceipt, WalletChain } from "./types.js";
import { reserveSpend } from "./limits.js";
import { requireSimulation } from "./simulate.js";
import { broadcastSigned } from "./broadcast.js";
import { confirm } from "./confirm.js";

export interface Signer {
  chain: WalletChain;
  address(): Promise<string>;
  simulate(intent: TransactionIntent): Promise<SimulationResult>;
  signAndSend(intent: TransactionIntent, allowed?: () => boolean): Promise<TxReceipt>;
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
const legacyIntent = transactionIntentSchema.omit({ reduce_only: true });
const reservationIntent = z.union([transactionIntentSchema, legacyIntent]);
const journalSchema = z.discriminatedUnion("event", [
  z.strictObject({ event:z.literal("reserve"), hash:z.string(), intent:reservationIntent, at:z.number() }),
  z.strictObject({ event:z.literal("release"), run_id:z.string() }),
  z.strictObject({ event:z.literal("signed"), run_id:z.string(), identifier:identifierSchema }),
  z.strictObject({ event:z.literal("withheld"), run_id:z.string(), identifier:identifierSchema }),
  z.strictObject({ event:z.literal("receipt"), run_id:z.string(), receipt:txReceiptSchema }),
]);
type WalletEvent = z.infer<typeof journalSchema>;
type Reservation = { hash:string; intent:TransactionIntent; reserved_at:number; attempts:Identifier[]; legacy:boolean; receipt?:TxReceipt };

export function createSigner(adapter: ChainAdapter, caps: WalletConfig, audit: Audit, journal: JournalEvent[],
  poll: typeof confirm = confirm, enabled: (intent: TransactionIntent) => boolean = () => true, safetyState: () => SafetyState = () => "normal"): Signer {
  if (adapter.chain !== caps.chain) throw new Error("WALLET_CHAIN_MISMATCH");
  const reservations = new Map<string,Reservation>();
  function apply(row: WalletEvent) {
    if (row.event === "reserve") {
      const legacy = !("reduce_only" in row.intent);
      const intent = { reduce_only: false, ...row.intent };
      reservations.set(row.intent.run_id,{hash:row.hash,intent,reserved_at:row.at,attempts:[],legacy});
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
    else if (row.event === "withheld") {
      if (record.attempts.at(-1)?.id !== row.identifier.id) throw new Error("WALLET_JOURNAL_INVALID");
      record.attempts.pop();
    } else record.receipt = row.receipt;
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
  async function execute(raw: TransactionIntent, recoverOnly: boolean, allowed?: () => boolean): Promise<TxReceipt | null> {
    const intent = parse(raw);
    const hash = createHash("sha256").update(JSON.stringify(intent)).digest("hex");
    const run_id = intent.run_id;
    const pending = (tx_hash: string): TxReceipt => ({chain:intent.chain,tx_hash,status:"pending"});
    const prior = reservations.get(run_id);
    if (prior && prior.hash !== hash) {
      const legacyHash = prior.legacy && createHash("sha256").update(JSON.stringify(legacyIntent.parse(
        (({ reduce_only, ...rest }) => rest)(intent),
      ))).digest("hex");
      if (!recoverOnly || prior.hash !== legacyHash) throw new Error("INTENT_CONFLICT");
    }
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
    authorize();
    if (!enabled(intent)) {
      if (known) return known;
      throw new Error("LIVE_EXECUTION_DISABLED");
    }
    const replacement = known?.status === "pending" && latest;
    if (replacement && (!adapter.replace || attempts.length >= 2 || now >= intent.deadline_sec * 1000)) return known!;
    if (BigInt(intent.max_fee_native) > BigInt(caps.max_fee_native)) throw new Error("FEE_LIMIT_EXCEEDED");
    if (now >= intent.deadline_sec * 1000) throw new Error("INTENT_EXPIRED");
    const otherReservations = [...reservations.values()].filter(item => item.intent.run_id !== run_id);
    if (otherReservations.some(item => item.attempts.length && !item.receipt)) throw new Error("UNRECONCILED_TRANSACTION");
    reserveSpend(intent,otherReservations.map(item => ({...item,pending:!item.receipt})),caps,now);
    if (!prior) await record({event:"reserve",intent,hash,at:now});
    const active = reservations.get(run_id)!.attempts;
    function authorize() {
      const state = safetyState();
      if (state === "disarmed") throw new Error("SIGNER_DISARMED");
      if (state === "reduce_only" && !intent.reduce_only) throw new Error("REDUCE_ONLY_VIOLATION");
    }
    function checkCurrentAuthorization() {
      if (Date.now() >= intent.deadline_sec * 1000) throw new Error("INTENT_EXPIRED");
      authorize();
      if (!enabled(intent)) throw new Error("LIVE_EXECUTION_DISABLED");
      if (allowed?.() === false) throw new Error("DEPLOYMENT_PAUSED");
    }
    async function send(prepared: Prepared) {
      requireSimulation(intent, prepared.simulation);
      await audit({stage:"wallet_simulation",status:"ok",gaps:[],detail:{run_id,simulation:prepared.simulation}});
      checkCurrentAuthorization();
      const signed = await prepared.sign();
      const identifier = identifierSchema.parse({id:signed.id,expires_at_height:signed.expires_at_height});
      if (active.some(attempt => attempt.id === identifier.id)) throw new Error("DUPLICATE_REPLACEMENT");
      checkCurrentAuthorization();
      await record({event:"signed",run_id,identifier});
      try { checkCurrentAuthorization(); }
      catch (error) {
        await record({event:"withheld",run_id,identifier});
        throw error;
      }
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
    async signAndSend(intent, allowed) { return (await enqueue(intent,false,allowed))!; },
  };
  function enqueue(intent: TransactionIntent, recoverOnly: boolean, allowed?: () => boolean) {
    const result = queue.then(async () => {
      const initial = !reservations.get(intent.run_id)?.attempts.length;
      const receipt = await execute(intent,recoverOnly,allowed);
      if (recoverOnly || !initial || !adapter.replace || receipt?.status !== "pending") return receipt;
      try { return await execute(intent,false,allowed); }
      catch (error) {
        if (error instanceof Error && ["FEE_LIMIT_EXCEEDED","INTENT_EXPIRED",
          "DAILY_LIMIT_EXCEEDED","PER_TRADE_LIMIT_EXCEEDED","BITCOIN_MEMPOOL_REJECTED","DEPLOYMENT_PAUSED","SIGNER_DISARMED","REDUCE_ONLY_VIOLATION"].includes(error.message)) return receipt;
        throw error;
      }
    });
    queue = result.then(() => undefined, () => undefined);
    return result;
  }
}
