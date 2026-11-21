import { z } from "zod";
import { signal } from "../strategy.js";

export default signal("vol-mcap-ratio", z.strictObject({
  minRatio: z.number().nonnegative().default(0.5),
}), (ctx, p) => {
  const now = ctx.current;
  return !!now.marketCap && now.volume/now.marketCap>p.minRatio;
}, "buy", [400, 200, 600]);
