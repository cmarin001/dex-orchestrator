import type { TransactionIntent } from "./types.js";
import type { WalletConfig } from "../../schemas/wallet-config.js";

export function reserveSpend(
  intent: TransactionIntent,
  prior: Iterable<{ intent: TransactionIntent; reserved_at: number; pending: boolean }>,
  caps: Pick<WalletConfig, "per_trade_limit_cents" | "daily_limit_cents">,
  now: number,
) {
  if (intent.size_cents > caps.per_trade_limit_cents) throw new Error("PER_TRADE_LIMIT_EXCEEDED");
  const day = Math.floor(now / 86_400_000);
  let committed = 0;
  for (const item of prior) {
    if (item.pending || Math.floor(item.reserved_at / 86_400_000) === day) committed += item.intent.size_cents;
  }
  if (committed + intent.size_cents > caps.daily_limit_cents) throw new Error("DAILY_LIMIT_EXCEEDED");
}
