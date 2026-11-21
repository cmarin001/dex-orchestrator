import { z } from "zod";
import { overlay } from "../strategy.js";

export default overlay("kelly-fraction", z.strictObject({
  kellyCap: z.number().nonnegative().default(0.25),
}), (ctx, p) => {
  if(!ctx.performance)return 0; const {winRate,payoff}=ctx.performance; return payoff>0?Math.max(0,Math.min(p.kellyCap,winRate-(1-winRate)/payoff)):0;
});
