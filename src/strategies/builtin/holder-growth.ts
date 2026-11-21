import { z } from "zod";
import { signal, baseline } from "../strategy.js";

export default signal("holder-growth", z.strictObject({
  windowMin: z.number().nonnegative().default(15),
  minNew: z.number().nonnegative().default(50),
}), (ctx, p) => {
  const now = ctx.current;
  const prior=baseline(ctx,p.windowMin); return prior?.holders!=null && now.holders!=null && now.holders-prior.holders>p.minNew;
}, "buy", [400, 200, 600]);
