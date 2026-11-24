import { z } from "zod";
import { chainSchema, tradeKey } from "../../schemas/common.js";
import type { ChainRouting } from "../../schemas/chain-routing.js";
import { equityCurveSchema } from "../../schemas/equity-curve.js";
import { scannerSchema } from "../../schemas/scanner.js";
import { projectTradeDetails } from "../logging/projections/trade-history.js";
import { isFill, type JournalEvent } from "../logging/types.js";
import { ControlConflict } from "./commands.js";

export const entityId = z.strictObject({ id: z.string().min(1).max(200) });
const date = z.iso.date();
const time = z.iso.datetime({ offset: true });
const ranges = { "1h": 1, "6h": 6, "24h": 24, "7d": 168, "30d": 720 } as const;
const hourMs = 3_600_000;
const range = z.enum(["1h", "6h", "24h", "7d", "30d", "ytd", "all"]).optional();
export const rangeQuery = z.strictObject({
  range,
  since: time.optional(),
  until: time.optional(),
}).refine(query => !(query.range && (query.since || query.until)) &&
  (!query.since || !query.until || Date.parse(query.since) <= Date.parse(query.until)));
export const chainQuery = z.strictObject({ range });
export const tradeQuery = z.object({
  from: date.optional(), to: date.optional(), run_id: z.string().optional(),
  token: z.string().optional(), cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export const deskTradeQuery = tradeQuery.extend({ strategy_id: z.string().min(1).max(200).optional() }).strict()
  .refine(query => !query.from || !query.to || query.from <= query.to);

export function entityWindow(query: z.infer<typeof rangeQuery>, now = Date.now()) {
  const end = query.until ? Date.parse(query.until) : now;
  const start = query.since ? Date.parse(query.since) : query.range === "ytd"
    ? Date.UTC(new Date(end).getUTCFullYear(), 0, 1)
    : query.range && query.range !== "all" ? end - ranges[query.range] * hourMs : null;
  return { since: start === null ? null : new Date(start).toISOString(), until: new Date(end).toISOString(),
    includes: (ms: number) => ms <= end && (start === null || ms >= start) };
}

export function tradePage<T extends { exit_at: number; run_id: string; token: string }>(
  rows: T[], query: z.infer<typeof tradeQuery>,
  key = ({ exit_at, run_id }: T) => exit_at + ":" + run_id,
) {
  const { from, to, token, limit, cursor } = query;
  const all = rows.filter(row => {
    const day = new Date(row.exit_at).toISOString().slice(0, 10);
    return (!from || day >= from) && (!to || day <= to) && (!token || row.token === token);
  });
  const found = cursor ? all.findIndex(row => key(row) === cursor) : -1;
  if (cursor && found < 0) throw new ControlConflict("invalid_cursor");
  const items = all.slice(found + 1, found + 1 + limit);
  const last = items.at(-1);
  return { items, next_cursor: last && found + 1 + limit < all.length ? key(last) : null };
}

export class AmbiguousRun extends ControlConflict {}

export function entityEvents(events: JournalEvent[], entity: Parameters<typeof tradeKey>[0]) {
  const key = tradeKey(entity);
  return events.filter(event => {
    const identity = event.identity ?? event.position;
    return identity && tradeKey(identity) === key;
  });
}

export function deskTrades(events: JournalEvent[]) {
  return projectTradeDetails(events).map(({ row, entry, trigger }) => ({
    ...row, entry_price_usd: row.entry_price, exit_price_usd: row.exit_price, reason: row.exit_reason,
    strategy_id: entry.strategy_id ?? null, trigger, tx_hash: row.tx_exit,
  }));
}

function tradeStats(rows: ReturnType<typeof deskTrades>) {
  const pnlCents = rows.reduce((sum, row) => sum + Math.round(row.pnl_usd * 100), 0);
  return { pnl_usd: pnlCents / 100, trades_closed: rows.length,
    win_rate: rows.length ? rows.filter(row => row.pnl_usd > 0).length / rows.length : null };
}

type MarkedPosition = {
  chain: string;
  cost_cents: number;
  unrealized_pnl_usd: number | null;
};

export function performance(events: JournalEvent[], positions: MarkedPosition[], query: z.infer<typeof rangeQuery>) {
  const { since, until, includes } = entityWindow(query);
  const trades = deskTrades(events).filter(row => includes(row.exit_at));
  const series = events.flatMap(event => {
    if (event.stage !== "equity-curve" || event.status !== "ok") return [];
    const row = equityCurveSchema.safeParse(event.detail).data;
    return row && includes(row.as_of * 1000)
      ? [{ at: new Date(row.as_of * 1000).toISOString(), equity_usd: row.equity_usd, drawdown_pct: row.drawdown_pct }]
      : [];
  }).sort((a, b) => a.at.localeCompare(b.at));
  const stats = tradeStats(trades);
  const summary = (rows: typeof trades) => {
    const { pnl_usd, trades_closed } = tradeStats(rows);
    return { pnl_usd, trades_closed };
  };
  const strategies = [...new Set(trades.flatMap(row => row.strategy_id === null ? [] : [row.strategy_id]))].sort();
  return { since, until, current_equity_usd: series.at(-1)?.equity_usd ?? null,
    realized_pnl_usd: stats.pnl_usd,
    unrealized_pnl_usd: query.until || positions.some(row => row.unrealized_pnl_usd === null) ? null
      : positions.reduce((sum, row) => sum + (row.unrealized_pnl_usd ?? 0), 0),
    win_rate: stats.win_rate, expectancy_usd: trades.length ? stats.pnl_usd / trades.length : null,
    fees_usd: null, average_hold_sec: trades.length ? trades.reduce((sum, row) => sum + row.hold_sec, 0) / trades.length : null,
    max_drawdown_pct: series.length ? series.reduce((max, row) => Math.max(max, row.drawdown_pct), 0) : null,
    series,
    by_chain: [...new Set(trades.map(row => row.chain))].sort()
      .map(chain => ({ chain, ...summary(trades.filter(row => row.chain === chain)) })),
    by_strategy: strategies.map(strategy_id => ({ strategy_id, ...summary(trades.filter(row => row.strategy_id === strategy_id)) })),
  };
}

const sizing = z.object({ proposal: z.object({ status: z.literal("SIZED") }), approved_cents: z.number().positive() });
const rug = z.object({ verdict: z.literal("PASS") });
function funnelStage(event: JournalEvent) {
  if (isFill(event.status)) return "filled";
  if (event.status !== "ok") return;
  if (event.stage === "rug-check" && rug.safeParse(event.detail).success) return "rug_pass";
  if (event.stage === "sizer" && sizing.safeParse(event.detail).success) return "sized";
}

export function funnel(events: JournalEvent[], query: z.infer<typeof rangeQuery>) {
  const { since, until, includes } = entityWindow(query);
  const counts = { scanned: 0, rug_pass: 0, sized: 0, filled: 0 };
  const reasons = new Map<string, number>();
  const bins = new Map<string, typeof counts>();
  const seen = new Set<string>();
  for (const event of events) {
    if (!includes(Date.parse(event.at))) continue;
    const day = event.at.slice(0, 10);
    const record = (stage: keyof typeof counts, identity: Parameters<typeof tradeKey>[0]) => {
      const key = stage + ":" + tradeKey(identity);
      if (seen.has(key)) return;
      seen.add(key);
      const bin = bins.get(day) ?? { scanned: 0, rug_pass: 0, sized: 0, filled: 0 };
      counts[stage]++;
      bin[stage]++;
      bins.set(day, bin);
    };
    if (event.stage === "scanner_batch" || event.stage === "scanner") {
      for (const row of scannerSchema.safeParse(event.detail).data ?? []) {
        if (row.token && row.pair) record("scanned", row);
      }
    }
    const identity = event.identity ?? event.position;
    const stage = funnelStage(event);
    if (identity && stage) record(stage, identity);
    if (event.stage === "pipeline" && (event.status === "skipped" || event.status === "failed")) {
      for (const reason of new Set(event.gaps)) reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
  }
  return { since, until, counts, reasons: Object.fromEntries(reasons),
    bins: [...bins].sort(([a], [b]) => a.localeCompare(b)).map(([at, values]) => ({ at, ...values })) };
}

export function chains(events: JournalEvent[], positions: MarkedPosition[], config: ChainRouting, query: z.infer<typeof chainQuery>) {
  const { includes } = entityWindow(query);
  const trades = deskTrades(events).filter(row => includes(row.exit_at));
  return { config, items: chainSchema.options.map(chain => {
    const open = positions.filter(row => row.chain === chain);
    const { pnl_usd, win_rate } = tradeStats(trades.filter(row => row.chain === chain));
    return { chain, enabled: config.enabledChains.includes(chain), capital_pct: config.perChainCapitalPct[chain] ?? null,
      exposure_usd: open.reduce((sum, row) => sum + row.cost_cents, 0) / 100, pnl_usd, win_rate,
      open_positions: open.length, filter: config.memecoinFilters[chain] ?? null,
      quote_supported: false, paper_execution_supported: true };
  }) };
}

export const entityRoutes = [
  { path: "/api/v1/positions/:id", method: "position", tool: "get_position", schema: entityId,
    description: "Read an open position by run ID, with its mark, exit policy and matching journal events." },
  { path: "/api/v1/trades", method: "trades", tool: "list_trades", schema: deskTradeQuery,
    description: "List closed trades newest first. Filter by date, token or strategy and use next_cursor for more rows." },
  { path: "/api/v1/trades/:id", method: "trade", tool: "get_trades_id", schema: entityId,
    description: "Read a closed trade and its matching journal events by run ID." },
  { path: "/api/v1/performance", method: "performance", tool: "get_performance", schema: rangeQuery,
    description: "Summarize closed-trade PnL and published equity for a date window, with unavailable metrics reported as null." },
  { path: "/api/v1/funnel", method: "funnel", tool: "get_funnel", schema: rangeQuery,
    description: "Count journaled candidates, rug passes, approved sizes and fills for a date window, with skips grouped by reason." },
  { path: "/api/v1/chains", method: "chains", tool: "list_chains", schema: chainQuery,
    description: "List chain routing configuration, current exposure and recent closed-trade outcomes by chain." },
] as const;
