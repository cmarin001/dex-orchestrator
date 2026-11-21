import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { handoff } from "../../schemas/common.js";
import { transactionIntentSchema } from "../../schemas/transaction-intent.js";
import type { WalletConfig } from "../../schemas/wallet-config.js";
import type { Audit } from "../logging/logger.js";
import type { JournalEvent } from "../logging/types.js";
import { CandidateError, SystemError } from "../orchestrator/errors.js";
import type { Equity } from "../state/equity.js";
import { positionSchema, type Position, type Positions } from "../state/positions.js";
import type { ExitPolicy } from "../../schemas/exit-policy.js";
import type { Handoff } from "../../schemas/common.js";
import type { Signer } from "./signer.js";

const orderSchema = z.strictObject({
  intent:transactionIntentSchema,identity:z.strictObject(handoff),position:positionSchema,
  source_run_id:z.string(),action:z.enum(["entry","exit"]), reason:z.enum(["target","stop","timeout"]).optional(),
});
type Order = z.infer<typeof orderSchema>;
const walletNotSent = new Set(["INTENT_EXPIRED","PER_TRADE_LIMIT_EXCEEDED","DAILY_LIMIT_EXCEEDED",
  "SIMULATION_FAILED","FEE_LIMIT_EXCEEDED","QUOTE_UNAVAILABLE","QUOTE_MISMATCH","ROUTE_MISMATCH",
  "UNRECONCILED_TRANSACTION","LIVE_EXECUTION_DISABLED","UNAPPROVED_PROGRAM","SIMULATION_TOKEN_MISMATCH","RPC_CHAIN_MISMATCH"]);

type Settings = {stable:string; stableDecimals:number; usdPerUnit:number; decimals:Map<string,number>};
type Shared = {onClose?: (chain:string,pnl:number)=>void; enabled: () => boolean; config:WalletConfig; signer:Signer; audit:Audit; journal:JournalEvent[]; positions:Positions; equity:Equity} & Settings;

export function createLiveExecution(settings: Shared) {
  const {config,signer,audit,positions,equity,stable,stableDecimals,usdPerUnit,decimals} = settings;
  const pending = new Map<string,Order>();
  for (const row of settings.journal) {
    if (row.stage === "live_intent") {
      const order = orderSchema.parse(row.detail);
      if (order.intent.chain !== config.chain) throw new SystemError("LIVE_JOURNAL_CHAIN_MISMATCH");
      pending.set(order.intent.run_id,order);
    }
    if (row.stage === "live_settled" && row.identity) pending.delete(row.identity.run_id);
  }
  let queue = Promise.resolve();
  function serialize<T>(fn:()=>Promise<T>) {
    const result = queue.then(fn);
    queue = result.then(()=>undefined,()=>undefined);
    return result;
  }
  async function execute(order: Order, recoverOnly = false) {
    const {intent,identity,position,action} = order;
    const receipt = await (recoverOnly ? signer.reconcile(intent) : signer.signAndSend(intent)).catch(async (error: unknown) => {
      if (!(error instanceof Error) || !walletNotSent.has(error.message)) throw new SystemError("Live execution requires reconciliation");
      if (error.message === "UNRECONCILED_TRANSACTION") return null;
      await audit({identity,stage:"live_settled",status:"failed",detail:{reason:error.message},gaps:[error.message]});
      pending.delete(intent.run_id);
      return null;
    });
    if ((!receipt && !recoverOnly) || receipt?.status === "pending") return false;
    if (!receipt || receipt.status === "replaced") {
      await audit({identity,stage:"live_settled",status:"failed",detail:receipt,gaps:["intent_not_landed"]});
      pending.delete(intent.run_id);
      return false;
    }
    if (receipt.status === "failed") {
      await audit({identity,stage:"live_settled",status:"failed",detail:receipt,gaps:["transaction_failed"]});
      pending.delete(intent.run_id);
      return false;
    }
    if (!receipt.amount_in || !receipt.amount_out || BigInt(receipt.amount_in) !== BigInt(intent.amount_in) ||
        BigInt(receipt.amount_out) < BigInt(intent.min_amount_out)) throw new SystemError("CONFIRMED_RECEIPT_REQUIRES_MANUAL_RECONCILIATION");
    const at = Date.now();
    if (action === "entry") {
      const units = Number(receipt.amount_out) / 10 ** tokenDecimals(identity.token);
      const price = position.cost_cents / 100 / units;
      const open = positionSchema.parse({...position,entry_price_usd:price,
        live_amount:receipt.amount_out,exit_policy:{...position.exit_policy,entry_price:price,entry_at:at}});
      await audit({identity,stage:"live_settled",status:"live_fill",detail:receipt,gaps:[],position:open});
      positions.record(open);
      equity.mark(open,price,at);
    } else {
      const proceeds = Math.floor(Number(receipt.amount_out) / 10 ** stableDecimals * 100);
      const exit_price = proceeds / 100 / (Number(receipt.amount_in) / 10 ** tokenDecimals(identity.token));
      if (!Number.isSafeInteger(proceeds) || proceeds <= 0 || !Number.isFinite(exit_price)) throw new SystemError("INVALID_PROCEEDS");
      await audit({identity,stage:"live_settled",status:"live_close",detail:receipt,gaps:[],position,
        close:{exit_at:at,exit_price,exit_reason:order.reason!,proceeds_cents:proceeds}});
      positions.close(position);
      equity.close(position,proceeds,at);
      settings.onClose?.(position.chain,proceeds-position.cost_cents);
    }
    pending.delete(intent.run_id);
    return true;
  }
  async function submit(order: Order) {
    if (!settings.enabled() || pending.size) return false;
    const validated = orderSchema.parse(order);
    await audit({identity:order.identity,stage:"live_intent",status:"ok",detail:validated,gaps:[]});
    pending.set(order.intent.run_id,validated);
    return execute(validated);
  }
  function tokenDecimals(token:string) {
    const n = decimals.get(config.chain === "solana" ? token : token.toLowerCase());
    if (n === undefined) throw new CandidateError("LIVE_TOKEN_DECIMALS_REQUIRED");
    return n;
  }
  function units(amount:number, precision:number, round: (value:number)=>number) {
    if (!Number.isFinite(amount) || amount <= 0) throw new CandidateError("LIVE_AMOUNT_INVALID");
    const scaled = amount * 10 ** precision;
    if (!Number.isSafeInteger(round(scaled)) || round(scaled) <= 0) throw new CandidateError("LIVE_AMOUNT_INVALID");
    return BigInt(round(scaled)).toString();
  }
  function intent(identity:Handoff, size_cents:number, token_in:string, token_out:string,
    amount_in:string, min_amount_out:string) {
    return transactionIntentSchema.parse({run_id:identity.run_id,chain:identity.chain,token_in,token_out,amount_in,
      min_amount_out,max_fee_native:config.max_fee_native,deadline_sec:Math.floor(Date.now()/1000)+60,
      size_cents,route:config.chain === "solana" ? "jupiter" : "0x"});
  }
  return {
    chain:config.chain,
    enabled:settings.enabled,
    perTradeCents:config.per_trade_limit_cents,
    async reconcile() {
      return serialize(async()=>{ for (const order of pending.values()) await execute(order,true); });
    },
    enter(identity:Handoff, cost_cents:number, price:number, slippageBps:number, exit_policy:ExitPolicy, expiresAt = Date.now()+60_000, strategyId?:string) {
      return serialize(async()=> {
        if (identity.chain !== config.chain || positions.get(identity) || identity.token === stable) return false;
        const settlement = units(cost_cents/100/usdPerUnit,stableDecimals,Math.floor);
        const actualSettlementUnits = Number(settlement) / 10 ** stableDecimals;
        const minimum = units((actualSettlementUnits/price)*(1-slippageBps/10_000),tokenDecimals(identity.token),Math.ceil);
        const hash = createHash("sha256").update(JSON.stringify([identity.run_id,identity.chain,identity.token,identity.pair])).digest("hex");
        const walletRun = { ...identity, run_id: hash.slice(0,8)+"-"+hash.slice(8,12)+"-4"+hash.slice(13,16)+"-8"+hash.slice(17,20)+"-"+hash.slice(20,32) };
        const tx = { ...intent(walletRun,cost_cents,stable,identity.token,settlement,minimum),
          deadline_sec:Math.min(Math.floor(expiresAt/1000),Math.floor(Date.now()/1000)+60) };
        return submit({identity:walletRun,intent:tx,source_run_id:identity.run_id,action:"entry",position:{...identity,cost_cents:Math.round(actualSettlementUnits*100),entry_price_usd:price,exit_policy,...(strategyId ? {strategy_id:strategyId} : {})}});
      });
    },
    exit(position:Position, price:number, slippageBps:number, reason:"target"|"stop"|"timeout") {
      return serialize(async()=> {
        if (!position.live_amount || position.chain !== config.chain || !positions.get(position)) return false;
        const identity = {chain:position.chain,token:position.token,pair:position.pair,run_id:randomUUID()};
        const usd = Number(position.live_amount) / 10 ** tokenDecimals(position.token) * price;
        const minimum = units(usd*(1-slippageBps/10_000),stableDecimals,Math.ceil);
        const tx = intent(identity,Math.ceil(usd*100*usdPerUnit),position.token,stable,position.live_amount,minimum);
        return submit({identity,intent:tx,source_run_id:position.run_id,action:"exit",position,reason});
      });
    },
  };
}
export type LiveExecution = ReturnType<typeof createLiveExecution>;
