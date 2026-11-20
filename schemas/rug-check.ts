import { z } from "zod";
import { handoff } from "./common.js";

export const rugCheckSchema = z.strictObject({
  ...handoff,
  verdict: z.enum(["PASS", "FAIL"]),
  checks: z.strictObject({
    renounced: z.boolean(), mint_auth: z.boolean(), freeze_auth: z.boolean(),
    lp_locked_or_burned: z.boolean(), honeypot: z.boolean(), tax_ok: z.boolean(),
    blacklist: z.boolean(), deployer_ok: z.boolean(), age_ok: z.boolean(), holder_conc_ok: z.boolean(),
  }),
  reason: z.string(),
});
interface ObservedRugChecks {
  renounced: boolean; mint_auth_disabled: boolean; freeze_auth_disabled: boolean;
  lp_locked_or_burned: boolean; honeypot_sim_ok: boolean; tax_bps: number;
  blacklist_present: boolean; deployer_rugged_before: boolean; holder_top10_pct: number;
}
export type RugChecksRaw = { [Key in keyof ObservedRugChecks]?: ObservedRugChecks[Key] | null };
