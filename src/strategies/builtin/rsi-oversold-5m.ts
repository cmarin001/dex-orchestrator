import { z } from "zod";
import { signal, rsi } from "../strategy.js";

export default signal("rsi-oversold-5m", z.strictObject({
  rsiPeriod: z.number().int().positive().default(14),
  threshold: z.number().nonnegative().default(30),
}), (ctx, p) => {
  const closes=ctx.candles?.filter(c=>c.interval===5).slice(-p.rsiPeriod-1).map(c=>c.close); if(!closes || closes.length<=p.rsiPeriod)return false; return rsi(closes)<p.threshold;
}, "buy", [300, 200, 360]);
