import { z } from "zod";
import { signal, window } from "../strategy.js";

export default signal("range-breakout", z.strictObject({
  rangeMaxPct: z.number().nonnegative().default(0.03),
  lookbackMin: z.number().nonnegative().default(30),
}), (ctx, p) => {
  const now = ctx.current;
  const rows=window(ctx,p.lookbackMin); if(rows.length<2)return false; const prices=rows.map(r=>r.price); const low=Math.min(...prices),high=Math.max(...prices); return low>0 && (high-low)/low<p.rangeMaxPct && now.price>high;
}, "buy", [400, 200, 480]);
