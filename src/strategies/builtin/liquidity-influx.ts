import { z } from "zod";
import { signal, baseline } from "../strategy.js";

export default signal("liquidity-influx", z.strictObject({
  windowMin: z.number().nonnegative().default(5),
  addPct: z.number().nonnegative().default(0.2),
}), (ctx, p) => {
  const now = ctx.current;
  const prior=baseline(ctx,p.windowMin); return !!prior && prior.liquidity>0 && now.liquidity>prior.liquidity*(1+p.addPct);
}, "buy", [600, 300, 600]);
