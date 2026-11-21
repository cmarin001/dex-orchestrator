import { z } from "zod";
import { signal, window, correlation } from "../strategy.js";

export default signal("btc-correlation", z.strictObject({
  lookbackMin: z.number().nonnegative().default(30),
  corrMin: z.number().nonnegative().default(0.7),
}), (ctx, p) => {
  const now = ctx.current;
  const rows=window(ctx,p.lookbackMin); const series=[...rows,now]; return now.btcPrice!==undefined && rows[0]?.btcPrice!==undefined && now.btcPrice>rows[0].btcPrice && correlation(series)>=p.corrMin;
}, "buy", [400, 200, 600]);
