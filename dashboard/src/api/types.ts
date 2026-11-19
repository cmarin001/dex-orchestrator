export type { LiveView } from "@schemas/live-view";
export type { RiskConfig } from "@schemas/risk-config";
import type { RiskConfig } from "@schemas/risk-config";
export type { TradeHistoryRow } from "@schemas/trade-history";
import type { TradeHistoryRow } from "@schemas/trade-history";

export interface JournalEvent { at: string; stage: string; status: string; gaps: string[]; detail?: unknown }
export interface Equity { current_equity: number; realized_cents: number; committed_cents: number; open_positions: number }
export interface RiskResponse { config: RiskConfig; as_of: number | null; actor: string | null; editable: boolean }
export interface TradePage { items: TradeHistoryRow[]; next_cursor: string | null }
