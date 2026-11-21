import type { WalletConfig } from "../schemas/wallet-config.js";
import type { Audit } from "../src/logging/logger.js";
import type { JournalEvent } from "../src/logging/types.js";
import type { ChainAdapter } from "../src/wallet/signer.js";
import type { TransactionIntent } from "../src/wallet/types.js";

export const caps: WalletConfig = {chain:"base",mode:"env",rpc_url:"http://localhost",
  per_trade_limit_cents:100,daily_limit_cents:200,max_fee_native:"1000",mev_protection:false};
export const intent: TransactionIntent = {chain:"base",run_id:"order-1",token_in:"stable",token_out:"token",
  amount_in:"100",min_amount_out:"15",route:"0x",size_cents:100,max_fee_native:"1000",
  deadline_sec:Math.floor(Date.now()/1000)+3600};
export const noWait = async (check: () => ReturnType<ChainAdapter["receipt"]>)=> check();

export function walletFixture() {
  const journal: JournalEvent[] = [];
  const audit: Audit = async event => { journal.push({...event,at:new Date().toISOString()}); };
  return {journal,audit};
}
