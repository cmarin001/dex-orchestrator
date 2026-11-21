import { z } from "zod";
import { signal, baseline } from "../strategy.js";

export default signal("holder-conc-drop", z.strictObject({
  dropPct: z.number().nonnegative().default(0.1),
  windowMin: z.number().nonnegative().default(30),
}), (ctx, p) => {
  const now = ctx.current;
  const prior=baseline(ctx,p.windowMin); return ctx.holding===true && prior?.top10!=null && now.top10!=null && now.top10<prior.top10*(1-p.dropPct);
}, "exit", [0, 0, 1]);
