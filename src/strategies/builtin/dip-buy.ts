import { z } from "zod";
import { signal, holdingVolume, baseline } from "../strategy.js";

export default signal("dip-buy", z.strictObject({
  dropPct: z.number().nonnegative().default(0.15),
  windowMin: z.number().nonnegative().default(60),
}), (ctx, p) => {
  const now = ctx.current;
  const prior=baseline(ctx,p.windowMin); return !!prior && now.price<=prior.price*(1-p.dropPct) && holdingVolume(ctx);
}, "buy", [500, 400, 600]);
