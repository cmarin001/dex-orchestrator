import { z } from "zod";

const flag = z.union([z.literal(0), z.literal(1)]).nullable();
export const reconChecksSchema = z.strictObject({
  renounced: flag,
  mint_auth_disabled: flag,
  freeze_auth_disabled: flag,
  lp_locked_or_burned: flag,
  honeypot_sim_ok: flag,
  blacklist_present: flag,
  deployer_rugged_before: flag,
  holder_count: z.number().int().nonnegative().nullable(),
  holder_top10_pct: z.number().min(0).max(100).nullable(),
  tax_bps: z.number().nonnegative().nullable(),
});

export function toRugChecks(input: unknown) {
  const checks = reconChecksSchema.parse(input);
  const boolean = (value: 0 | 1 | null) => (value === null ? null : value === 1);
  return {
    ...checks,
    renounced: boolean(checks.renounced),
    mint_auth_disabled: boolean(checks.mint_auth_disabled),
    freeze_auth_disabled: boolean(checks.freeze_auth_disabled),
    lp_locked_or_burned: boolean(checks.lp_locked_or_burned),
    honeypot_sim_ok: boolean(checks.honeypot_sim_ok),
    blacklist_present: boolean(checks.blacklist_present),
    deployer_rugged_before: boolean(checks.deployer_rugged_before),
  };
}
