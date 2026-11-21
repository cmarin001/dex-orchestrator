import { z } from "zod";
import { signal, window, mean, holdingVolume } from "../strategy.js";

export default signal("mean-revert-1h", z.strictObject({
  lookbackMin: z.number().nonnegative().default(60),
  deviationPct: z.number().nonnegative().default(0.08),
}), (ctx, p) => {
  const now = ctx.current;
  const rows=window(ctx,p.lookbackMin); return rows.length>1 && now.price < mean(rows.map(r=>r.price))*(1-p.deviationPct) && holdingVolume(ctx);
}, "buy", [300, 200, 300]);
