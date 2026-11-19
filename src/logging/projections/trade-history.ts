import type { TradeHistoryRow } from "../../../schemas/trade-history.js";
import type { JournalEvent } from "../types.js";

export function projectTradeHistory(events: readonly JournalEvent[]): TradeHistoryRow[] {
  const entries = new Map<string, JournalEvent>();
  const rows: TradeHistoryRow[] = [];
  for (const event of events) {
    if (event.status === "paper_fill" && event.position) entries.set(event.position.run_id, event);
    if (event.status !== "paper_close" || !event.position || !event.close) continue;
    const entry = entries.get(event.position.run_id);
    if (!entry?.position) continue;
    const { run_id, chain, token, pair, cost_cents, entry_price_usd, exit_policy } = entry.position;
    const enteredAt = exit_policy?.entry_at ?? Date.parse(entry.at);
    const closed = event.close;
    const profitCents = closed.proceeds_cents - cost_cents;
    rows.push({ run_id, chain, token, pair, entry_at: enteredAt, exit_at: closed.exit_at,
      hold_sec: Math.max(0, Math.floor((closed.exit_at - enteredAt) / 1000)),
      entry_price: entry_price_usd, exit_price: closed.exit_price, size_usd: cost_cents / 100,
      pnl_usd: profitCents / 100, pnl_pct: profitCents / cost_cents * 100,
      exit_reason: closed.exit_reason, tx_entry: null, tx_exit: null });
    entries.delete(run_id);
  }
  return rows.sort((a, b) => b.exit_at - a.exit_at || a.run_id.localeCompare(b.run_id));
}
