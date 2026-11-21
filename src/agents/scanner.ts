import { z } from "zod";
import type { Handoff } from "../../schemas/common.js";
import { scannerInputSchema, scannerSchema } from "../../schemas/scanner.js";
import type { ScannerInput, ScannerRow } from "../../schemas/scanner.js";
import type { CallAgent } from "./call.js";

const wireSchema = z.strictObject({ rows: scannerSchema });

function key(row: ScannerInput["feed"][number]): string {
  return JSON.stringify([row.chain, row.token, row.pair, row.trigger, row.liquidity_usd, row.vol_1h_usd, row.age_sec]);
}

function matchesFeed(rows: ScannerRow[], data: ScannerInput, runId: string): boolean {
  if (rows.length !== data.feed.length) return false;
  const counts = new Map<string, number>();
  for (const item of data.feed) {
    const id = key(item);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const eligible = data.feed.filter(
    (item) =>
      !data.seen.includes(item.token) &&
      item.age_sec >= data.config.min_age_sec &&
      item.vol_1h_usd >= data.config.min_vol_1h_usd &&
      item.liquidity_usd >= data.config.min_liquidity_usd,
  );
  const ratio = (row: ScannerInput["feed"][number]) => (row.liquidity_usd ? row.vol_1h_usd / row.liquidity_usd : 0);
  eligible.sort((a, b) => ratio(b) - ratio(a) || b.liquidity_usd - a.liquidity_usd);
  const ranked = eligible.slice(0, data.config.top_n ?? 20);
  let lastRank = 0;
  const ranks = new Set<number>();
  return (
    rows.every((row) => {
      const id = key(row);
      const remaining = counts.get(id) ?? 0;
      if (row.run_id !== runId || remaining === 0) return false;
      if (data.seen.includes(row.token) && row.reason !== "dedup") return false;
      const rank = ranked[row.rank_score - 1];
      if (!row.skipped) {
        if (
          !rank ||
          ratio(rank) !== ratio(row) ||
          rank.liquidity_usd !== row.liquidity_usd ||
          !eligible.some((item) => key(item) === id) ||
          ranks.has(row.rank_score)
        )
          return false;
        if (row.rank_score <= lastRank) return false;
        lastRank = row.rank_score;
        ranks.add(row.rank_score);
      }
      counts.set(id, remaining - 1);
      return true;
    }) && ranks.size === ranked.length
  );
}

export const scanner = (call: CallAgent, identity: Handoff, data: ScannerInput) =>
  call({
    prompt: "scanner",
    schema: scannerSchema,
    wireSchema,
    identity,
    data: scannerInputSchema.parse(data),
    wire: (value) => {
      const parsed = wireSchema.safeParse(value);
      return parsed.success ? parsed.data.rows : undefined;
    },
    validate: (rows) => identity.run_id === data.run_id && matchesFeed(rows, data, identity.run_id),
  });
