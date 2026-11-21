import { z } from "zod";
import { signal } from "../strategy.js";

export default signal("new-pool-snipe", z.strictObject({
  maxAgeSec: z.number().nonnegative().default(180),
}), (ctx, p) => {
  const now = ctx.current;
  return ctx.rugPassed===true && now.age<p.maxAgeSec;
}, "buy", [1000, 500, 180]);
