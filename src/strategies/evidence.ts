import { readFile } from "node:fs/promises";
import { z } from "zod";
import { targetSchema } from "../../schemas/common.js";
import { targetKey } from "../cache/merge.js";

const supplement=z.strictObject({
  target:targetSchema, source:z.string().min(1), fetched_at:z.number().int(),
  candles:z.array(z.strictObject({interval:z.union([z.literal(1),z.literal(5)]),open:z.number().positive(),
    close:z.number().positive(),volume:z.number().nonnegative(),at:z.number().int()})).max(1500).optional(),
  wallet_buys:z.array(z.string()).max(1000).optional(),
  btc_price:z.number().positive().optional(), whale_net:z.number().optional(), gas_usd:z.number().nonnegative().optional(),
  launchpad:z.string().min(1).optional(), sell_simulation:z.boolean().optional(),
});
type Evidence=z.infer<typeof supplement>;

export class StrategyEvidence {
  private rows=new Map<string,Evidence>();
  constructor(private path?:string) {}
  async refresh(now:number) {
    if (!this.path) return;
    const next=new Map<string,Evidence>();
    const text=await readFile(this.path,"utf8").catch(error=>{
      if ((error as NodeJS.ErrnoException).code==="ENOENT") return "";
      throw error;
    });
    if (text && !text.endsWith("\n")) return;
    for (const line of text.split("\n").filter(Boolean)) {
      const row=supplement.parse(JSON.parse(line));
      if (row.fetched_at>now || row.fetched_at+60_000<=now) continue;
      const key=targetKey(row.target);
      if ((next.get(key)?.fetched_at ?? -Infinity)<=row.fetched_at) next.set(key,row);
    }
    this.rows=next;
  }
  get(key:string,now:number) {
    const row=this.rows.get(key);
    return row && row.fetched_at<=now && now<row.fetched_at+60_000 ? row : undefined;
  }
}
