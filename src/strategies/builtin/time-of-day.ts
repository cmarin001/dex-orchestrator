import { z } from "zod";
import { overlay } from "../strategy.js";

export default overlay("time-of-day", z.strictObject({
  deadHoursUtc: z.array(z.number().int().min(0).max(23)).default([]),
}), (ctx, p) => {
  const now = ctx.current;
  return p.deadHoursUtc.includes(new Date(now.at).getUTCHours())?0:1;
});
