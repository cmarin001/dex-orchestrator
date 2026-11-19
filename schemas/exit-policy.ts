import { z } from "zod";

export const timeoutRungSchema = z.strictObject({
  at_sec: z.number().int().nonnegative(),
  target_profit_bps: z.number().int().min(1).max(10_000),
});
export type TimeoutRung = z.infer<typeof timeoutRungSchema>;
export const defaultLadder: TimeoutRung[] = [
  { at_sec: 0, target_profit_bps: 500 },
  { at_sec: 600, target_profit_bps: 250 },
  { at_sec: 900, target_profit_bps: 50 },
];
export const ladderSchema = z.array(timeoutRungSchema).nonempty().max(20).refine((rungs) =>
  rungs[0]?.at_sec === 0 && rungs.every((rung, index) => {
    const previous = rungs[index - 1];
    return !previous || previous.at_sec < rung.at_sec && previous.target_profit_bps >= rung.target_profit_bps;
  }), "Ladder must start at zero and lower the target over time");

const common = {
  entry_price: z.number().positive(),
  entry_at: z.number().int().nonnegative(),
  min_profit_bps_for_exit: z.number().int().min(1).max(10_000),
  timeout_ladder: ladderSchema,
  max_hold_sec: z.number().int().positive(),
};
export const exitPolicySchema = z.discriminatedUnion("mode", [
  z.strictObject({ ...common, mode: z.literal("profit_only") }),
  z.strictObject({ ...common, mode: z.literal("stop_loss"), stop_loss_bps: z.number().int().min(1).max(10_000) }),
]);
export type ExitPolicy = z.infer<typeof exitPolicySchema>;
