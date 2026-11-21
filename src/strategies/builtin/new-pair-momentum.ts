import { z } from "zod";
import { signal } from "../strategy.js";

export default signal("new-pair-momentum", z.strictObject({
  maxAgeSec: z.number().nonnegative().default(600),
  minVol: z.number().nonnegative().default(10000),
}), (ctx, p) => {
  const now = ctx.current;
  return now.age<p.maxAgeSec && now.volume>p.minVol;
}, "buy", [800, 500, 300]);
