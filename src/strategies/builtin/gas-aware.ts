import { z } from "zod";
import { guard } from "../strategy.js";

export default guard("gas-aware", z.strictObject({
  maxGasUsd: z.number().nonnegative().default(2),
}), (ctx, p) => {
  const now = ctx.current;
  return now.gasUsd!==undefined && now.gasUsd<=p.maxGasUsd;
});
