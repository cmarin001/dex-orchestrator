import { tradeKey } from "../../schemas/common.js";
import type { Handoff } from "../../schemas/common.js";
import { failureKind, log } from "../logging/operational.js";
import type { TradeReview } from "./paper-entry.js";

type Approval={id:string; deadline:number; value:number};

export class JevExitRequests {
  private readonly approvals=new Map<string,Approval>();
  private readonly attempted=new Map<string,number>();
  private active=false;

  constructor(private readonly review:TradeReview, private readonly enabled:()=>boolean) {}

  isEnabled() { return this.enabled(); }

  consider(identity:Handoff,value:number,cost:number,heldSec:number,deadline:number,signal:AbortSignal) {
    if (!this.isEnabled() || signal.aborted) return undefined;
    const now=Date.now();
    const key=tradeKey(identity);
    const previous=this.approvals.get(key);
    if (previous && previous.deadline>now && value>=previous.value) return previous;
    this.approvals.delete(key);
    if (this.active || deadline<=now || now-(this.attempted.get(key) ?? -Infinity)<30_000) return undefined;
    this.attempted.set(key,now);
    this.active=true;
    void this.review({identity,deadline,facts:{current_value_cents:value,entry_cost_cents:cost,held_sec:heldSec}},signal)
      .then(id=>{
        if (id && this.attempted.get(key)===now && this.isEnabled() && !signal.aborted && Date.now()<deadline) {
          this.approvals.set(key,{id,deadline,value});
        }
      })
      .catch(error=>log("warn","jev.exit_review_failed",{run_id:identity.run_id,chain:identity.chain,failure_kind:failureKind(error)}))
      .finally(()=>{this.active=false;});
  }

  consume(identity:Handoff) { this.approvals.delete(tradeKey(identity)); }

  prune(positions:readonly Handoff[]) {
    const keys=new Set(positions.map(tradeKey));
    for (const key of this.attempted.keys()) if (!keys.has(key)) {
      this.attempted.delete(key);
      this.approvals.delete(key);
    }
  }
}
