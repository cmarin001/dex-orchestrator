import { z } from "zod";
import { signal } from "../strategy.js";

export default signal("copy-trade", z.strictObject({
  watchedWallets: z.array(z.string()).default([]),
}), (ctx, p) => {
  return ctx.walletBuys?.some(w=>p.watchedWallets.includes(w)) === true;
}, "buy", [500, 300, 900]);
