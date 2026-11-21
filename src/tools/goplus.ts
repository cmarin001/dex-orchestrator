import { z } from "zod";
import type { RugChecksRaw } from "../../schemas/rug-check.js";
import type { Target } from "../../schemas/common.js";
import { getJson } from "./dexscreener.js";
import type { Fetch } from "./dexscreener.js";

export const evmChainIds = { ethereum: 1, bsc: 56, base: 8453 } as const;
export type Finding = { assessment: "clear" | "flagged" | "unknown"; reason: string; checks_raw?: RugChecksRaw };
const bit = z.enum(["0", "1"]).optional();
const authority = z.object({ status: bit });
const tokenReport = z.object({
  is_honeypot: bit, cannot_sell_all: bit, is_open_source: bit,
  mintable: authority.optional(), freezable: authority.optional(),
  is_mintable: bit, is_blacklisted: bit, owner_address: z.string().optional(),
});
const response = z.object({ code: z.literal(1), result: z.record(z.string(), tokenReport) });

export async function goPlus({ chain, token }: Target, request: Fetch = fetch, accessToken?: string): Promise<Finding> {
  const path = chain === "solana" ? "solana/token_security" : `token_security/${evmChainIds[chain]}`;
  const url = new URL(`https://api.gopluslabs.io/api/v1/${path}`);
  url.searchParams.set("contract_addresses", token);
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
  const parsed = response.safeParse(await getJson(url, request, headers));
  const report = parsed.success && parsed.data.result[token];
  if (report) {
    const checks = chain === "solana"
      ? [report.mintable?.status, report.freezable?.status]
      : [report.is_honeypot, report.cannot_sell_all,
        report.is_open_source === undefined ? undefined : report.is_open_source === "1" ? "0" : "1"];
    const mint = chain === "solana" ? report.mintable?.status : report.is_mintable;
    const freeze = report.freezable?.status;
    const checks_raw: RugChecksRaw = {
      mint_auth_disabled: mint === undefined ? undefined : mint === "0",
      freeze_auth_disabled: freeze === undefined ? undefined : freeze === "0",
      blacklist_present: report.is_blacklisted === undefined ? undefined : report.is_blacklisted === "1",
      renounced: chain !== "solana" && /^0x[0-9a-f]{40}$/i.test(report.owner_address ?? "")
        ? /^0x0{40}$/i.test(report.owner_address ?? "") : undefined,
    };
    if (checks.includes("1")) return { assessment: "flagged", reason: "GoPlus flagged a required check", checks_raw };
    if (checks.every((flag) => flag === "0")) return { assessment: "clear", reason: "Required GoPlus checks reported clear", checks_raw };
    return { assessment: "unknown", reason: "Required GoPlus fields unavailable", checks_raw };
  }
  return { assessment: "unknown", reason: "Required GoPlus fields unavailable" };
}
