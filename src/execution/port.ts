import type {Handoff} from "../../schemas/common.js";
import type {ExitPolicy} from "../../schemas/exit-policy.js";
import type {PaperClose} from "../../schemas/trade-history.js";
import type {WalletChain} from "../../schemas/transaction-intent.js";
import type {Position} from "../state/positions.js";

export interface EntryAuthorization {
  readonly revision:string;
  current():Promise<boolean>;
}

export interface ExecutionPort {
  readonly chain:WalletChain;
  readonly perTradeCents:number;
  enabled():boolean;
  reconcile():Promise<void>;
  enter(identity:Handoff,costCents:number,price:number,slippageBps:number,policy:ExitPolicy,
    expiresAt?:number,strategyId?:string,authorization?:EntryAuthorization):Promise<boolean>;
  exit(position:Position,price:number,slippageBps:number,reason:PaperClose["exit_reason"],
    allowed?:()=>boolean):Promise<boolean>;
}
