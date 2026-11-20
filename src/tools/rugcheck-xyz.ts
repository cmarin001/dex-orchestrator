import { z } from "zod";
import type { Target } from "../../schemas/common.js";
import { getJson } from "./dexscreener.js";
import type { Fetch } from "./dexscreener.js";
import type { Finding } from "./goplus.js";

const response = z.object({
  risks: z.array(z.object({ name: z.string(), level: z.string() })),
  lpLockedPct: z.number().min(0).max(100).optional(),
  score_normalised: z.number().min(0).max(100),
});

export async function rugCheckXyz({ token }: Target, request: Fetch = fetch): Promise<Finding> {
  const url = new URL(`https://api.rugcheck.xyz/v1/tokens/${encodeURIComponent(token)}/report/summary`);
  const parsed = response.safeParse(await getJson(url, request));
  if (!parsed.success) return { assessment: "unknown", reason: "Missing RugCheck report" };
  const { risks, score_normalised: score } = parsed.data;
  const checks_raw = { lp_locked_or_burned: parsed.data.lpLockedPct === undefined ? undefined : parsed.data.lpLockedPct === 100 };
  const flagged = risks.length > 0 || score >= 20;
  return flagged
    ? { assessment: "flagged", reason: "RugCheck returned risk findings or a high score", checks_raw }
    : { assessment: "clear", reason: "RugCheck returned no risk findings and a low score", checks_raw };
}
