import { z } from "zod";
import { overlay } from "../strategy.js";

export default overlay("anti-signal", z.strictObject({
  minDisagree: z.number().int().positive().default(3),
}), (ctx, p, signals) => {
  return signals.filter(s=>s.side==="exit").length>=p.minDisagree?0:1;
});
