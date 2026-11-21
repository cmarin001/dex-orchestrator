import { z } from "zod";
import { overlay } from "../strategy.js";

export default overlay("session-aware", z.strictObject({
  sessionParams: z.strictObject({asia:z.number().min(0).max(1),europe:z.number().min(0).max(1),americas:z.number().min(0).max(1)}).default({"asia":1,"europe":1,"americas":1}),
}), (ctx, p) => {
  const now = ctx.current;
  const h=new Date(now.at).getUTCHours(); const multiplier=h<8?p.sessionParams.asia:h<16?p.sessionParams.europe:p.sessionParams.americas; return multiplier;
});
