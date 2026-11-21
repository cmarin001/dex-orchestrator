import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { z } from "zod";
import { normalizeAddress, tradeKey } from "../../schemas/common.js";
import { defaultRisk } from "../../schemas/risk-config.js";
import { equityCurveSchema } from "../../schemas/equity-curve.js";
import { chartPointSchema } from "../../schemas/live-view.js";
import { readJournal } from "../logging/logger.js";
import type { JournalEvent } from "../logging/types.js";
import type { Position } from "../state/positions.js";
import { readRisk } from "../state/risk-config.js";
import { commandSchema, ControlConflict, exitInput, Inbox, rejectInput, riskInput, toggle } from "./commands.js";

export const auditQuery = z.strictObject({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  since: z.iso.datetime({ offset: true }).optional(),
  cursor: z.coerce.number().int().nonnegative().optional(),
});
export const controlInputs = { pause: toggle, resume: toggle, risk: riskInput, exit: exitInput, reject: rejectInput };
type Control = keyof typeof controlInputs;

function openPositions(events: JournalEvent[]) {
  const positions = new Map<string, { position: Position; opened: number; mark: z.infer<typeof chartPointSchema> | null }>();
  for (const e of events) {
    if (e.position && e.status === "paper_fill") positions.set(tradeKey(e.position),
      { position: e.position, opened: Date.parse(e.at), mark: null });
    if (e.position && e.status === "paper_close") positions.delete(tradeKey(e.position));
    if (e.stage === "position_mark" && e.identity && e.status === "ok") {
      const p = positions.get(tradeKey(e.identity));
      const mark = chartPointSchema.safeParse(e.detail);
      if (p && mark.success) p.mark = mark.data;
    }
  }
  return [...positions.values()];
}

function publications(events: JournalEvent[]) {
  return events.filter(e => e.stage === "equity-curve" && e.status === "ok").flatMap(e => {
    const parsed = equityCurveSchema.safeParse(e.detail);
    return parsed.success ? [parsed.data] : [];
  }).slice(-50).reverse();
}

export function createControl(options: { auditPath: string; riskPath: string; inboxPath?: string;
  events?: () => Promise<JournalEvent[]> }) {
  const events = options.events ?? (() => readJournal(options.auditPath, true));
  const inbox = new Inbox(options.inboxPath ?? options.auditPath + ".controls");
  const risk = async () => (await readRisk(options.riskPath)) ?? { config: defaultRisk, as_of: null, actor: null };
  return {
    async health() {
      if (!options.events) await access(options.auditPath);
      await events();
      return { status: "ok", mode: "paper", journal_readable: true };
    },
    async status() {
      const journal = await events();
      const worker = journal.findLast(e => e.stage === "worker_lifecycle");
      const cycle = journal.findLast(e => e.stage === "worker_cycle");
      const marker = journal.findLast(e => e.stage === "control" && e.status === "ok" &&
        ["pause", "resume"].includes(commandSchema.parse(e.detail).action.type));
      const equity = publications(journal)[0];
      const breaker = (worker && cycle && worker.at > cycle.at ? undefined : cycle?.detail) as { breaker_until?: number } | undefined;
      return { loop_state: worker?.detail ?? "unknown", last_cycle_at: cycle?.at ?? null,
        breaker_open: (breaker?.breaker_until ?? 0) > Date.now(),
        breaker_until: breaker?.breaker_until ?? null,
        entries_paused: !!marker && commandSchema.parse(marker.detail).action.type === "pause",
        open_positions: openPositions(journal).length, current_equity: equity?.equity_usd ?? null,
        drawdown_pct: equity?.drawdown_pct ?? null };
    },
    async positions() {
      return { items: openPositions(await events()).map(({position, opened, mark}) => ({
        ...position, size_usd: position.cost_cents / 100, size_tokens: position.cost_cents / 100 / position.entry_price_usd,
        age_sec: Math.max(0, Math.floor((Date.now() - (position.exit_policy?.entry_at ?? opened)) / 1000)),
        mark, unrealized_pnl_usd: mark ? (position.cost_cents / 100) * (mark.price / position.entry_price_usd - 1) : null,
      })) };
    },
    async equity() {
      const history = publications(await events());
      return { latest: history[0] ?? null, history };
    },
    async audit(input: unknown) {
      const {limit, since, cursor} = auditQuery.parse(input);
      const journal = await events();
      const items = [];
      let index = Math.min(cursor ?? journal.length, journal.length) - 1;
      for (; index >= 0 && items.length < limit; index--) {
        const e = journal[index]!;
        if (!since || Date.parse(e.at) >= Date.parse(since)) items.push(e);
      }
      return { items, next_cursor: index >= 0 ? index + 1 : null };
    },
    async candidates() {
      const journal = await events();
      const scan = journal.findLast(e => e.stage === "scanner_batch");
      const cycle = journal.findLast(e => e.stage === "worker_cycle");
      return { scanner: scan?.detail ?? null, watched: (cycle?.detail as { watched?: unknown })?.watched ?? [] };
    },
    risk,
    async submit(type: Control, raw: unknown, actor: string) {
      const { request_id = randomUUID(), ...body } = controlInputs[type].parse(raw);
      const command = await inbox.submit(request_id, actor, JSON.stringify({type, body}), async () => {
        switch (type) {
          case "pause": return {type};
          case "resume": return {type};
          case "risk": return {type, config:riskInput.parse(raw).config};
          case "reject": {
            const {chain,token} = rejectInput.parse(raw);
            return {type, target:{chain,token}};
          }
          case "exit": {
            const id = exitInput.parse(raw);
            const matches = openPositions(await events()).filter(({position: p}) => id.run_id
              ? p.run_id === id.run_id
              : p.chain === id.chain && normalizeAddress(p.chain,p.token) === normalizeAddress(p.chain,id.token!));
            if (matches.length !== 1) throw new ControlConflict("Expected exactly one open position");
            const p = matches[0]!.position;
            if (!p.exit_policy) throw new ControlConflict("Position has no exit policy");
            const {run_id,chain,token,pair} = p;
            return {type, position:{run_id,chain,token,pair}};
          }
        }
      });
      const journal = await events();
      const result = journal.findLast(e => e.stage === "control" && commandSchema.parse(e.detail).id === command.id);
      return { request_id: command.id, actor: command.actor, action:command.action,
        state: result ? result.status === "ok" ? "applied" : "rejected" : "queued", gaps:result?.gaps ?? [] };
    },
  };
}
export type ControlService = ReturnType<typeof createControl>;
