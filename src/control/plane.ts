import { createHash, randomUUID } from "node:crypto";
import { signalRecord } from "../../schemas/control-plane.js";
import type { Phase3Command, SignalRecord } from "../../schemas/control-plane.js";
import type { Signal } from "../../schemas/signal.js";
import type { Audit } from "../logging/logger.js";
import type { JournalEvent } from "../logging/types.js";
import { commandSchema } from "./commands.js";
import { applySetting } from "../mode/config.js";
import type { Settings } from "../mode/config.js";
import type { Registry } from "../strategies/registry.js";
import type { Budget } from "../providers/budget.js";

type Status = "pending"|"approved"|"rejected"|"expired"|"used"|"observed";
type Tracked = SignalRecord & {state:Status};

export class ControlPlane {
  private readonly signals=new Map<string,Tracked>();
  private readonly byKey=new Map<string,string>();
  private orderRevision: string;
  get providerOrderRevision() { return this.orderRevision; }
  private readonly closed=new Map<string,number[]>();
  noteClose(chain:string,pnl:number) {
    const rows=this.closed.get(chain) ?? [];
    this.closed.set(chain,[...rows.slice(-49),pnl]);
  }
  performance(chain:string) {
    const sample=this.closed.get(chain) ?? [];
    const gain=sample.filter(v=>v>0),losses=sample.filter(v=>v<0);
    return {count:sample.length,winRate:sample.length ? gain.length/sample.length : .5,
      payoff:gain.length && losses.length ? (gain.reduce((a,b)=>a+b,0)/gain.length)/(Math.abs(losses.reduce((a,b)=>a+b,0))/losses.length) : 0};
  }
  constructor(readonly settings:Settings,readonly registry:Registry,readonly budget:Budget,
    private audit:Audit,private clock=Date.now,private liveChain?:string) {
    this.orderRevision = createHash("sha256").update(JSON.stringify(settings.policy.order)).digest("hex");
  }
  replay(event:JournalEvent) {
    if (event.close && event.position) this.noteClose(event.position.chain,event.close.proceeds_cents-event.position.cost_cents);
    if (event.stage==="control" && event.status==="ok") {
      const { action, id } = commandSchema.parse(event.detail);
      if (action.type === "phase3") this.apply(action.command, id);
    }
    if (event.stage==="strategy_signal") {
      const row=signalRecord.parse(event.detail);
      this.signals.set(row.id,{...row,state:row.requires_approval?"pending":"observed"});
      if (row.requires_approval) this.byKey.set(row.identity_key,row.id);
    }
    if ((event.stage==="signal_expired" || event.stage==="signal_consumed") && typeof event.detail==="string") {
      const signal=this.signals.get(event.detail);
      if (signal) signal.state=event.stage==="signal_expired"?"expired":"used";
    }
  }
  validate(action:Phase3Command) {
    if (action.type==="chain" && this.liveChain && action.config.enabledChains.some(chain=>chain!==this.liveChain)) {
      return "chain_not_configured_in_wallet";
    }
    if (action.type === "provider_order") {
      if (action.expected_revision !== this.orderRevision) return "stale_provider_order";
      if (action.provider_ids.length !== Object.keys(this.settings.definitions).length ||
          action.provider_ids.some(id => !Object.hasOwn(this.settings.definitions, id))) return "invalid_provider_order";
    }
    if (action.type==="provider" && !Object.hasOwn(this.settings.definitions,action.id)) return "provider_unknown";
    if (action.type==="strategy") {
      const item=this.registry.get(action.id);
      if (!item) return "strategy_unknown";
      if (action.settings.params && !item.params.safeParse(action.settings.params).success) return "invalid_strategy_params";
    }
    if (action.type==="signal") {
      const signal=this.signals.get(action.id);
      if (!signal || signal.state==="expired" || signal.expires_at<=this.clock()) return "signal_missing_or_expired";
      if (signal.state!=="pending" && signal.state!==(action.approve?"approved":"rejected")) return "signal_already_decided";
    }
    return null;
  }
  apply(action: Phase3Command, requestId?: string) {
    applySetting(this.settings, action);
    if (action.type === "provider_order" && requestId) this.orderRevision = requestId;
    if (action.type==="signal") {
      const signal=this.signals.get(action.id);
      if (signal) signal.state=action.approve?"approved":"rejected";
    }
  }
  async expire() {
    for (const signal of this.signals.values()) {
      if ((signal.state==="pending" || signal.state==="approved") && signal.expires_at<=this.clock()) {
        await this.audit({stage:"signal_expired",status:"skipped",gaps:["human_approval_expired"],detail:signal.id});
        signal.state="expired";
      }
    }
  }
  async signal(key:string,value:Signal,sizeFactor:number,requireApproval:boolean, timeoutSec:number) {
    const previous=this.signals.get(this.byKey.get(key) ?? "");
    if (requireApproval && previous && previous.expires_at>this.clock()) {
      if (previous.state==="approved" && JSON.stringify(previous.signal)===JSON.stringify(value) &&
          previous.size_factor===sizeFactor) {
        await this.audit({stage:"signal_consumed",status:"ok",gaps:[],detail:previous.id});
        previous.state="used";
        return previous.expires_at > this.clock();
      }
      return false;
    }
    const at=this.clock();
    const signal={id:randomUUID(),signal:value,identity_key:key,requires_approval:requireApproval,
      created_at:at,expires_at:at+timeoutSec*1000,size_factor:sizeFactor};
    await this.audit({stage:"strategy_signal",status:"ok",gaps:[],detail:signal});
    this.signals.set(signal.id,{...signal,state:requireApproval?"pending":"observed"});
    if (requireApproval) this.byKey.set(key,signal.id);
    return !requireApproval;
  }
  async noteDegradation(mode:string,reason:string) {
    await this.audit({stage:"mode_degraded",status:"ok",gaps:[reason],detail:{mode}});
  }
  recentSignals() {
    return [...this.signals.values()].slice(-100).reverse();
  }
}
