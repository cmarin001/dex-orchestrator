import { z } from "zod";
import { signal, baseline } from "../strategy.js";

export default signal("whale-accum", z.strictObject({
  windowMin: z.number().nonnegative().default(30),
  netPct: z.number().nonnegative().default(0.05),
}), (ctx, p) => {
  const now = ctx.current;
  const prior=baseline(ctx,p.windowMin); return prior?.whaleNet!=null && now.whaleNet!=null && now.whaleNet-prior.whaleNet >= p.netPct;
}, "buy", [500, 300, 900]);
