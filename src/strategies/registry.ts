import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { signalSchema } from "../../schemas/signal.js";
import type { Signal } from "../../schemas/signal.js";
import type { z } from "zod";
import type { strategySetting } from "../../schemas/strategy.js";
import { log } from "../logging/operational.js";
import { builtins } from "./builtins.js";
import { aggregate } from "./aggregator.js";
import type { Strategy, StrategyContext } from "./strategy.js";
import type { aggregatorSchema } from "../../schemas/strategy.js";

type Settings = Record<string,z.infer<typeof strategySetting>>;
export class Registry {
  private byId=new Map(builtins.map(s=>[s.id,s]));
  list() { return [...this.byId.values()]; }
  get(id:string) { return this.byId.get(id); }
  async reload(directory = new URL("./custom/",import.meta.url).pathname) {
    this.byId=new Map(builtins.map(s=>[s.id,s]));
    const files=await readdir(directory).catch(error=>{
      if ((error as NodeJS.ErrnoException).code==="ENOENT") return [];
      throw error;
    });
    for (const file of files.filter(name=>name.endsWith(".js") || (name.endsWith(".ts")&&!name.endsWith(".d.ts"))).sort()) {
      try {
        const url=pathToFileURL(join(directory,file));
        url.searchParams.set("reload",String(Date.now()));
        const entry=(await import(url.href)).default as Strategy;
        if (!entry?.id || !entry.params?.safeParse || typeof entry.evaluate!=="function" || this.byId.has(entry.id)) throw new Error();
        this.byId.set(entry.id,entry);
      } catch { log("warn","strategy.disabled",{reason:"invalid_custom_strategy"}); }
    }
  }
  decide(ctx:StrategyContext, settings:Settings, options:z.input<typeof aggregatorSchema> & {onDisagreement?:(value:boolean)=>void;side?:Signal["side"]}) {
    const report=options.onDisagreement;
    const signals=[];
    const overlays=[];
    let eligible=0, buyAllowed=true, exitAllowed=true;
    for (const strategy of this.list()) {
      const setting=settings[strategy.id];
      if (!(setting?.enabled ?? strategy.kind==="signal") || !strategy.chains.includes(ctx.chain)) continue;
      const parsed=strategy.params.safeParse(setting?.params ?? {});
      if (!parsed.success) { log("warn","strategy.disabled",{component:strategy.id,reason:"invalid_params"}); continue; }
      if (strategy.kind==="overlay") { overlays.push({strategy,params:parsed.data}); continue; }
      if (strategy.kind==="guard") {
        if (!strategy.factor?.(ctx,parsed.data,[])) {
          if (strategy.id==="honeypot-recheck") exitAllowed=false; else buyAllowed=false;
        }
        continue;
      }
      eligible++;
      const signal=strategy.evaluate(ctx,parsed.data);
      if (signal) signals.push(signalSchema.parse(signal));
    }
    const filtered=signals.filter(s=>s.side==="buy"?buyAllowed:exitAllowed);
    report?.(filtered.some(s=>s.side==="buy") && filtered.some(s=>s.side==="exit"));
    const {onDisagreement,side,...policy}=options;
    const decision=aggregate(side ? filtered.filter(signal=>signal.side===side) : filtered,policy,eligible);
    if (!decision) return null;
    let sizeFactor=1;
    for (const {strategy,params} of overlays) {
      if (strategy.id==="anti-signal" && decision.side!=="buy") continue;
      const factor=strategy.factor?.(ctx,params,filtered) ?? 1;
      if (!factor) return null;
      if (strategy.id==="kelly-fraction") sizeFactor=factor;
      else decision.confidence*=factor;
    }
    return decision.confidence>=(options.minConfidence ?? .5) ? {...decision,sizeFactor} : null;
  }
}
