import { isFill, isClose } from "../types.js";
import { tradeKey } from "../../../schemas/common.js";
import { txReceiptSchema } from "../../../schemas/tx-result.js";
import type { TradeHistoryRow } from "../../../schemas/trade-history.js";
import { scannerSchema, type ScannerRow } from "../../../schemas/scanner.js";
import type { Position } from "../../state/positions.js";
import type { JournalEvent } from "../types.js";

type TradeDetail = { row: TradeHistoryRow; entry: Position; trigger: ScannerRow["trigger"] | null };

export function projectTradeDetails(events: readonly JournalEvent[]): TradeDetail[] {
  const entries = new Map<string, JournalEvent>();
  const rows: TradeDetail[] = [];
  const triggers = new Map<string, ScannerRow["trigger"]>();
  for (const event of events) {
    if (event.stage === "scanner" && event.status === "ok") {
      for (const row of scannerSchema.safeParse(event.detail).data ?? []) {
        if (!row.skipped) triggers.set(tradeKey(row), row.trigger);
      }
    }
    if (isFill(event.status) && event.position) entries.set(tradeKey(event.position), event);
    if (!isClose(event.status) || !event.position || !event.close) continue;
    const entry = entries.get(tradeKey(event.position));
    if (!entry?.position) continue;
    const { run_id, chain, token, pair, cost_cents, entry_price_usd, exit_policy } = entry.position;
    const enteredAt = exit_policy?.entry_at ?? Date.parse(entry.at);
    const closed = event.close;
    const profitCents = closed.proceeds_cents - cost_cents;
    rows.push({ entry: entry.position, trigger: triggers.get(tradeKey(entry.position)) ?? null, row: { run_id, chain, token, pair, entry_at: enteredAt, exit_at: closed.exit_at,
      hold_sec: Math.max(0, Math.floor((closed.exit_at - enteredAt) / 1000)),
      entry_price: entry_price_usd, exit_price: closed.exit_price, size_usd: cost_cents / 100,
      pnl_usd: profitCents / 100, pnl_pct: profitCents / cost_cents * 100,
      exit_reason: closed.exit_reason, tx_entry: txReceiptSchema.safeParse(entry.detail).data?.tx_hash ?? null,
      tx_exit: txReceiptSchema.safeParse(event.detail).data?.tx_hash ?? null } });
    entries.delete(tradeKey(event.position));
    triggers.delete(tradeKey(event.position));
  }
  return rows.sort((a, b) => b.row.exit_at - a.row.exit_at || a.row.run_id.localeCompare(b.row.run_id));
}

export function projectTradeHistory(events: readonly JournalEvent[]): TradeHistoryRow[] {
  return projectTradeDetails(events).map(({ row }) => row);
}
