import { z } from "zod";
import { signal } from "../strategy.js";

export default signal("momentum-ladder", z.strictObject({
  candles: z.number().int().positive().default(3),
  volRising: z.boolean().default(true),
}), (ctx, p) => {
  const rows=ctx.candles?.filter(c=>c.interval===1).slice(-p.candles); return !!rows && rows.length===p.candles && rows.every((c,i)=>c.close>c.open && (!p.volRising || i===0 || c.volume>rows[i-1]!.volume));
}, "buy", [400, 200, 300]);
