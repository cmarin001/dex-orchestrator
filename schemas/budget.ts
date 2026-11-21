import { z } from "zod";
export const budgetSchema = z.strictObject({
  dailyUsdCap: z.number().nonnegative().default(1),
  perProvider: z.record(z.string(), z.number().nonnegative()).default({}),
  onExhaust: z.enum(["degrade_to_strategies","degrade_to_human","pause"]).default("degrade_to_strategies"),
  resetAtUtcHour: z.number().int().min(0).max(23).default(0),
});
export type BudgetConfig = z.infer<typeof budgetSchema>;
