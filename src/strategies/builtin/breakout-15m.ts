import { z } from "zod";
import { signal, window, avgVol } from "../strategy.js";

export default signal("breakout-15m", z.strictObject({
  lookbackMin: z.number().nonnegative().default(15),
  breakoutMult: z.number().nonnegative().default(1.02),
  volMult: z.number().nonnegative().default(2),
}), (ctx, p) => {
  const now = ctx.current;
  const rows = window(ctx,p.lookbackMin); return rows.length > 1 && now.price > Math.max(...rows.map(r=>r.price))*p.breakoutMult && avgVol(ctx)>0 && now.volume > avgVol(ctx)*p.volMult;
}, "buy", [500, 300, 600]);
