import { isFill, isClose } from "../logging/types.js";
import { randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { z } from "zod";
import { normalizeAddress, tradeKey } from "../../schemas/common.js";
import { defaultRisk } from "../../schemas/risk-config.js";
import { equityCurveSchema } from "../../schemas/equity-curve.js";
import { chartPointSchema } from "../../schemas/live-view.js";
import { projectTradeHistory } from "../logging/projections/trade-history.js";
import { modeConfigSchema } from "../../schemas/mode-config.js";
import { readJournal } from "../logging/logger.js";
import type { JournalEvent } from "../logging/types.js";
import type { Position } from "../state/positions.js";
import { readRisk } from "../state/risk-config.js";
import { commandSchema, ControlConflict, exitInput, Inbox, rejectInput, riskInput, toggle, liveExecutionInput } from "./commands.js";
import { createPhase3Api } from "./phase3.js";
import { HarnessGrants } from "../harness/policy.js";
import { SafetyGate } from "./safety.js";
import { AmbiguousRun, chainQuery, chains, deskTradeQuery, deskTrades, entityEvents, entityId, funnel, performance, rangeQuery, tradePage, tradeQuery } from "./entity-reads.js";
import { join, dirname } from "node:path";

export const auditQuery = z.strictObject({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  since: z.iso.datetime({ offset: true }).optional(),
  cursor: z.coerce.number().int().nonnegative().optional(),
});
export const controlInputs = { "live-execution": liveExecutionInput, pause: toggle, resume: toggle, risk: riskInput, exit: exitInput, reject: rejectInput };
type Control = keyof typeof controlInputs;

function openPositions(events: JournalEvent[]) {
  const positions = new Map<string, { position: Position; opened: number; mark: z.infer<typeof chartPointSchema> | null }>();
  for (const e of events) {
    if (e.position && isFill(e.status)) positions.set(tradeKey(e.position),
      { position: e.position, opened: Date.parse(e.at), mark: null });
    if (e.position && isClose(e.status)) positions.delete(tradeKey(e.position));
    if (e.stage === "position_mark" && e.identity && e.status === "ok") {
      const p = positions.get(tradeKey(e.identity));
      const mark = chartPointSchema.safeParse(e.detail);
      if (p && mark.success) p.mark = mark.data;
    }
  }
  return [...positions.values()];
}

function positionItems(journal: JournalEvent[], now = Date.now()) {
  return openPositions(journal).map(({ position, opened, mark }) => ({
    ...position, size_usd: position.cost_cents / 100,
    size_tokens: position.cost_cents / 100 / position.entry_price_usd,
    age_sec: Math.max(0, Math.floor((now - (position.exit_policy?.entry_at ?? opened)) / 1000)),
    mark, unrealized_pnl_usd: mark ? (position.cost_cents / 100) * (mark.price / position.entry_price_usd - 1) : null,
  }));
}

function publications(events: JournalEvent[]) {
  return events.filter(e => e.stage === "equity-curve" && e.status === "ok").flatMap(e => {
    const parsed = equityCurveSchema.safeParse(e.detail);
    return parsed.success ? [parsed.data] : [];
  }).slice(-50).reverse();
}

function executionMode(journal: JournalEvent[]) {
  const event = journal.findLast(row => row.stage === "execution_mode");
  return z.object({mode:z.enum(["paper","live"])}).safeParse(event?.detail).data?.mode ?? "paper";
}

const cycleData = z.object({
  breaker_until: z.number().nullable().optional(),
  loop_interval_sec: z.number().positive().optional(),
  duration_ms: z.number().nonnegative().optional(),
});

function workerState(journal: JournalEvent[]) {
  const lifecycle = journal.filter(e => e.stage === "worker_lifecycle" && e.status === "ok");
  const cycle = journal.findLast(e => e.stage === "worker_cycle" && e.status === "ok");
  const last = lifecycle.at(-1);
  return { lifecycle, cycle, state: last?.detail === "running" || last?.detail === "stopped" ? last.detail : "unknown" };
}

function latencySummary(samples: number[]) {
  const sorted = samples.sort((a, b) => a - b);
  const percentile = (p: number) => sorted[Math.ceil(sorted.length * p) - 1] ?? null;
  return { p50: percentile(.5), p95: percentile(.95), p99: percentile(.99) };
}

export function createControl(options: { auditPath: string; riskPath: string; inboxPath?: string;
  events?: () => Promise<JournalEvent[]>; budgetPath?:string; deployHealth?: { version: string; intervalMs: number } }) {
  const events = options.events ?? (() => readJournal(options.auditPath, true));
  const inbox = new Inbox(options.inboxPath ?? options.auditPath + ".controls");
  const harnessGrants = new HarnessGrants(join(inbox.path, "harness-grants"));
  const safety = new SafetyGate(inbox.path);
  const risk = async () => (await readRisk(options.riskPath)) ?? { config: defaultRisk, as_of: null, actor: null };
  const phase3=createPhase3Api(events,inbox,options.budgetPath ?? process.env.BUDGET_PATH ?? join(dirname(options.auditPath),"budget.jsonl"));
  async function readableJournal() {
    if (!options.events) await access(options.auditPath);
    return events();
  }
  return {
    phase3,
    harnessGrants,
    safety,
    readEvents: events,
    async health() {
      const journal = await readableJournal();
      return { status: "ok", ok: true, mode: executionMode(journal), journal_readable: true,
        version: options.deployHealth?.version ?? null, last_cycle_at: workerState(journal).cycle?.at ?? null,
        loop_interval_sec: options.deployHealth ? options.deployHealth.intervalMs / 1000 : null };
    },
    async systemHealth() {
      const journal = await readableJournal();
      const { lifecycle, cycle, state } = workerState(journal);
      const now = Date.now();
      const starts = lifecycle.filter(e => e.detail === "running");
      const durations = journal.filter(e => e.stage === "worker_cycle" && e.status === "ok").slice(-50)
        .flatMap(e => {
          const duration = cycleData.safeParse(e.detail).data?.duration_ms;
          return duration === undefined ? [] : [duration];
        });
      return {
        as_of: new Date(now).toISOString(),
        worker: { state, last_cycle_at: cycle?.at ?? null,
          uptime_sec: state === "running" && starts.length ? Math.max(0, Math.floor((now - Date.parse(starts.at(-1)!.at)) / 1000)) : null,
          restarts: starts.length ? starts.length - 1 : null },
        cycle_latency_ms: latencySummary(durations),
        agent_latency: [],
        cache: { recon_hit_pct: null, response_hit_pct: null, dedup_count: null },
        journal: { readable: true, events_last_minute: journal.filter(e => {
          const at = Date.parse(e.at);
          return at >= now - 60_000 && at <= now;
        }).length },
        capabilities: [
          { method: "GET", path: "/api/v1/health", available: true, reason: null },
          { method: "GET", path: "/api/v1/status", available: true, reason: null },
          { method: "GET", path: "/api/v1/system/health", available: true, reason: null },
        ],
      };
    },
    async status() {
      const journal = await events();
      const { lifecycle, cycle, state } = workerState(journal);
      const marker = journal.findLast(e => e.stage === "control" && e.status === "ok" &&
        ["pause", "resume"].includes(commandSchema.parse(e.detail).action.type));
      const mode = executionMode(journal);
      const liveCommand = journal.findLast(e => e.stage === "control" && e.status === "ok" &&
        commandSchema.parse(e.detail).action.type === "live-execution");
      const liveAction = liveCommand ? commandSchema.parse(liveCommand.detail).action : undefined;
      const equity = publications(journal)[0];
      const worker = lifecycle.at(-1);
      const detail = worker && cycle && worker.at > cycle.at ? undefined : cycleData.safeParse(cycle?.detail).data;
      const positions = openPositions(journal);
      const day = new Date().toISOString().slice(0, 10);
      const dailyPnl = projectTradeHistory(journal)
        .filter(row => new Date(row.exit_at).toISOString().slice(0, 10) === day)
        .reduce((cents, row) => cents + Math.round(row.pnl_usd * 100), 0);
      const lastMode = journal.findLast(row => {
        if (row.stage !== "control" || row.status !== "ok") return false;
        const action = commandSchema.parse(row.detail).action;
        return action.type === "phase3" && action.command.type === "mode";
      });
      const modeAction = lastMode ? commandSchema.parse(lastMode.detail).action : undefined;
      const operatingMode = modeAction?.type === "phase3" && modeAction.command.type === "mode"
        ? modeAction.command.config.mode : modeConfigSchema.parse({mode: process.env.OPERATING_MODE || undefined}).mode;
      const signer_state = safety.state();
      return { signer_state, loop_state: state, last_cycle_at: cycle?.at ?? null,
        operating_mode: operatingMode, cycle_duration_ms: detail?.duration_ms ?? null,
        loop_interval_sec: detail?.loop_interval_sec ?? (options.deployHealth ? options.deployHealth.intervalMs / 1000 : null),
        exposure_usd: positions.reduce((sum, row) => sum + row.position.cost_cents, 0) / 100,
        daily_pnl_usd: dailyPnl / 100,
        breaker_open: (detail?.breaker_until ?? 0) > Date.now(),
        breaker_until: detail?.breaker_until ?? null,
        entries_paused: signer_state !== "normal" || (!!marker && commandSchema.parse(marker.detail).action.type === "pause"),
        execution_mode: mode,
        live_execution_enabled: signer_state === "normal" && mode === "live" && (liveAction?.type === "live-execution" && liveAction.enabled === true),
        open_positions: positions.length, current_equity: equity?.equity_usd ?? null,
        drawdown_pct: equity?.drawdown_pct ?? null };
    },
    async positions() {
      return { items: positionItems(await events()) };
    },
    async position(raw: unknown) {
      const { id } = entityId.parse(raw);
      const journal = await events();
      const matches = positionItems(journal).filter(row => row.run_id === id);
      if (matches.length > 1) throw new AmbiguousRun("Run ID matches multiple entities");
      if (matches.length === 0) return null;
      const position = matches[0]!;
      return { ...position, exit_policy: position.exit_policy ?? null, events: entityEvents(journal, position) };
    },
    async legacyTrades(raw: unknown) {
      return tradePage(projectTradeHistory(await events()), tradeQuery.parse(raw));
    },
    async trades(raw: unknown) {
      const query = deskTradeQuery.parse(raw);
      const rows = deskTrades(await events()).filter(row =>
        (!query.run_id || row.run_id === query.run_id) && (!query.strategy_id || row.strategy_id === query.strategy_id));
      return tradePage(rows, query, row => Buffer.from(JSON.stringify([row.exit_at, tradeKey(row)])).toString("base64url"));
    },
    async trade(raw: unknown) {
      const { id } = entityId.parse(raw);
      const journal = await events();
      const matches = deskTrades(journal).filter(row => row.run_id === id);
      if (matches.length > 1) throw new AmbiguousRun("Run ID matches multiple entities");
      if (matches.length === 0) return null;
      const trade = matches[0]!;
      return { ...trade, events: entityEvents(journal, trade) };
    },
    async performance(raw: unknown) {
      const query = rangeQuery.parse(raw);
      const journal = await events();
      return performance(journal, positionItems(journal), query);
    },
    async funnel(raw: unknown) {
      const query = rangeQuery.parse(raw);
      return funnel(await events(), query);
    },
    async chains(raw: unknown) {
      const query = chainQuery.parse(raw);
      const journal = await events();
      return chains(journal, positionItems(journal), await phase3.chainConfig(journal), query);
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
          case "live-execution": return {type, enabled:liveExecutionInput.parse(raw).enabled};
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
