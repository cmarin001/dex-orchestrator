import type { ExitPolicy } from "../../schemas/exit-policy.js";

export function activeTarget(policy: ExitPolicy, now: number): number {
  const elapsed = Math.max(0, Math.min((now - policy.entry_at) / 1000, policy.max_hold_sec));
  const rung = policy.timeout_ladder.findLast(({ at_sec }) => at_sec <= elapsed);
  return Math.max(policy.min_profit_bps_for_exit, rung?.target_profit_bps ?? 0);
}

export function canExit(policy: ExitPolicy, mark: { price: number; at: number }): boolean {
  if (!Number.isFinite(mark.price) || mark.price <= 0 || !Number.isFinite(mark.at) || mark.at < policy.entry_at) return false;
  const target = policy.entry_price * (1 + activeTarget(policy, mark.at) / 10_000);
  return mark.price >= target || (policy.mode === "stop_loss" &&
    mark.price <= policy.entry_price * (1 - policy.stop_loss_bps / 10_000));
}
