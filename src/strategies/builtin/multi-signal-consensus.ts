import { z } from "zod";
import { overlay } from "../strategy.js";

export default overlay("multi-signal-consensus", z.strictObject({
  minAgree: z.number().int().positive().default(2),
  strategyIds: z.array(z.string()).default([]),
}), (ctx, p, signals) => {
  return signals.filter(s=>s.side==="buy" && (!p.strategyIds.length || p.strategyIds.includes(s.strategyId))).length>=p.minAgree?1:0;
});
