import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { BudgetConfig } from "../../schemas/budget.js";

const rowSchema=z.strictObject({
  id:z.string().uuid(), provider:z.string(), at:z.number().int(),
  usd:z.number().nonnegative(),
});
type Entry=z.infer<typeof rowSchema>;

export class Budget {
  private queue=Promise.resolve();
  constructor(private path:string,private clock=Date.now) {}
  private async entries() {
    const text=await readFile(this.path,"utf8").catch(error=>{
      if ((error as NodeJS.ErrnoException).code==="ENOENT") return "";
      throw error;
    });
    if (text && !text.endsWith("\n")) throw new Error("Incomplete budget journal");
    const rows=new Map<string,Entry>();
    for (const line of text.trim().split("\n").filter(Boolean)) {
      const parsed:unknown=JSON.parse(line);
      if (z.object({kind:z.literal("revision"),request_id:z.string()}).safeParse(parsed).success) continue;
      const row=rowSchema.parse(parsed);
      rows.set(row.id,row);
    }
    return [...rows.values()];
  }
  async status(config:BudgetConfig) {
    const at=this.clock();
    const offset=config.resetAtUtcHour*3_600_000;
    const start=Math.floor((at-offset)/86_400_000)*86_400_000+offset;
    const spent:Record<string,number>=Object.create(null);
    for (const row of await this.entries()) if (row.at>=start && row.at<=at) {
      spent[row.provider]=(spent[row.provider] ?? 0)+row.usd;
    }
    const total=Object.values(spent).reduce((a,b)=>a+b,0);
    return {spent,total,remaining:Math.max(0,config.dailyUsdCap-total),reset_at:start+86_400_000};
  }
  async canSpend(provider:string,cost:number,config:BudgetConfig) {
    const info=await this.status(config);
    return Number.isFinite(cost) && cost>=0 && cost<=info.remaining &&
      cost+(info.spent[provider] ?? 0)<=(config.perProvider[provider] ?? Infinity);
  }
  private async append(row:Entry) {
    await mkdir(dirname(this.path),{recursive:true});
    await appendFile(this.path,JSON.stringify(row)+"\n",{mode:0o600,flush:true});
  }
  reserve(provider:string,cost:number,config:BudgetConfig) {
    const result=this.queue.then(async()=>{
      if (!await this.canSpend(provider,cost,config)) return null;
      const row={id:randomUUID(),at:this.clock(),usd:cost,provider};
      await this.append(row);
      return async (actual:number) => {
        if (!Number.isFinite(actual) || actual<0) return;
        const settled=this.queue.then(()=>this.append({...row,usd:actual}));
        this.queue=settled.then(()=>undefined,()=>undefined);
        await settled;
      };
    });
    this.queue=result.then(()=>undefined,()=>undefined);
    return result;
  }
}
