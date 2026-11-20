import { z } from "zod";
import type { Handoff } from "../../schemas/common.js";
import { scannerSchema } from "../../schemas/scanner.js";
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
  return rows.every(row => {
    const id = key(row);
    const remaining = counts.get(id) ?? 0;
    if (row.run_id !== runId || remaining === 0) return false;
    counts.set(id, remaining - 1);
    return true;
  });
}

export const scanner = (call: CallAgent, identity: Handoff, data: ScannerInput) =>
  call({
    prompt: "scanner", schema: scannerSchema, wireSchema, identity, data,
    wire: value => {
      const parsed = wireSchema.safeParse(value);
      return parsed.success ? parsed.data.rows : undefined;
    },
    validate: rows => matchesFeed(rows, data, identity.run_id),
  });
