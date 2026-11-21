import { z } from "zod";
import { guard } from "../strategy.js";

export default guard("honeypot-recheck", z.strictObject({

}), (ctx, p) => {
  return ctx.holding===true && ctx.sellSimulation===true;
});
