import { z } from "zod";
import { signal, baseline } from "../strategy.js";

export default signal("liq-drain-exit", z.strictObject({
  dropPct: z.number().nonnegative().default(0.15),
  windowMin: z.number().nonnegative().default(5),
}), (ctx, p) => {
  const now = ctx.current;
  const prior=baseline(ctx,p.windowMin); return ctx.holding===true && !!prior && now.liquidity<prior.liquidity*(1-p.dropPct);
}, "exit", [0, 0, 1]);
