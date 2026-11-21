import { z } from "zod";
import type { Target } from "../../schemas/common.js";
import { getJson } from "./dexscreener.js";
import type { Fetch } from "./dexscreener.js";

export const evmChainIds = { ethereum: 1, polygon: 137, arbitrum: 42161, optimism: 10, bsc: 56, base: 8453 } as const;
export type Finding = { assessment: "clear" | "flagged" | "unknown"; reason: string };
const bit = z.enum(["0", "1"]).optional();
const authority = z.object({ status: bit });
const tokenReport = z.object({
  is_honeypot: bit, cannot_sell_all: bit, is_open_source: bit,
  mintable: authority.optional(), freezable: authority.optional(),
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
    if (checks.includes("1")) return { assessment: "flagged", reason: "GoPlus flagged a required check" };
    if (checks.every((flag) => flag === "0")) return { assessment: "clear", reason: "Required GoPlus checks reported clear" };
  }
  return { assessment: "unknown", reason: "Required GoPlus fields unavailable" };
}
