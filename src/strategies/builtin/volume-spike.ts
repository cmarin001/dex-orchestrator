import { z } from "zod";
import { signal, avgVol } from "../strategy.js";

export default signal("volume-spike", z.strictObject({
  volMult: z.number().nonnegative().default(5),
  minLiq: z.number().nonnegative().default(50000),
}), (ctx, p) => {
  const now = ctx.current;
  return avgVol(ctx)>0 && now.volume>avgVol(ctx)*p.volMult && now.liquidity>p.minLiq;
}, "buy", [400, 200, 480]);
