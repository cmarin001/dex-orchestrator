import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { defaultRisk, riskConfigSchema } from "../../schemas/risk-config.js";
import { liveViews } from "../live/publisher.js";
import { projectTradeHistory } from "../logging/projections/trade-history.js";
import { readJournal } from "../logging/logger.js";
import type { JournalEvent } from "../logging/types.js";
import { appendRisk, readRisk } from "../state/risk-config.js";
import { bearerAuth } from "./auth.js";

const querySchema = z.object({
  from: z.iso.date().optional(), to: z.iso.date().optional(), run_id: z.string().optional(),
  token: z.string().optional(), cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export function createDashboardApi(options: { token: string; auditPath: string; riskPath: string;
  initialCents: number; actor?: string; origin?: string; events?: () => Promise<JournalEvent[]>; readOnly?: boolean }) {
  const app = new Hono();
  if (options.origin) app.use("*", cors({ origin: options.origin, allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "OPTIONS"] }));
  app.use("*", async (c, next) => { c.header("Cache-Control", "no-store"); await next(); });
  app.use("*", bearerAuth(options.token));
  const events = options.events ?? (() => readJournal(options.auditPath, true));
  app.onError((error, c) => { console.error("Dashboard API:", error.name); return c.json({ error: "dashboard_data_unavailable" }, 503); });
  app.get("/health", c => c.json({ status: "ok", mode: "paper" }));
  app.get("/journal", async c => {
    const query = querySchema.safeParse(c.req.query());
    if (!query.success) return c.json({ error: "invalid_filters" }, 400);
    const { run_id, from, to, limit } = query.data;
    const items = (await events()).filter(e => (!run_id || e.identity?.run_id === run_id) &&
      (!from || e.at.slice(0, 10) >= from) && (!to || e.at.slice(0, 10) <= to));
    return c.json((run_id && !c.req.query("limit") ? items : items.slice(-limit)).reverse());
  });
  app.get("/live-view", async c => {
    const token = c.req.query("token");
    return c.json(liveViews(await events()).filter(view => !token || view.token === token));
  });
  app.get("/live-view/stream", c => {
    const token = c.req.query("token");
    return streamSSE(c, async stream => {
      for (let frame = 0; frame < 10 && !stream.aborted; frame += 1) {
        await stream.writeSSE({ event: "live-view",
          data: JSON.stringify(liveViews(await events()).filter(view => !token || view.token === token)) });
        await stream.sleep(5000);
      }
    }, async (_error, stream) => {
      await stream.writeSSE({ event: "unavailable", data: "dashboard_data_unavailable" });
    });
  });
  app.get("/equity", async c => {
    const journal = await events();
    const realized = projectTradeHistory(journal).reduce((sum, row) => sum + Math.round(row.pnl_usd * 100), 0);
    const open = new Map<string, number>();
    for (const e of journal) {
      if (e.status === "paper_fill" && e.position) open.set(e.position.run_id, e.position.cost_cents);
      if (e.status === "paper_close" && e.position) open.delete(e.position.run_id);
    }
    const markedCents = liveViews(journal).reduce((sum, view) => {
      const entry = view.marks.findLast(mark => mark.side === "buy");
      if (!entry || !view.current_mark) return sum;
      return sum + Math.round(entry.size_usd * 100 * (view.current_mark.price / view.entry_price - 1));
    }, 0);
    return c.json({ current_equity: options.initialCents + realized + markedCents,
      realized_cents: realized, open_positions: open.size, committed_cents: [...open.values()].reduce((a, b) => a + b, 0) });
  });
  app.get("/trades", async c => {
    const query = querySchema.safeParse(c.req.query());
    if (!query.success) return c.json({ error: "invalid_filters" }, 400);
    const { from, to, token, limit, cursor } = query.data;
    const all = projectTradeHistory(await events()).filter(row => {
      const day = new Date(row.exit_at).toISOString().slice(0, 10);
      return (!from || day >= from) && (!to || day <= to) && (!token || row.token === token);
    });
    const key = ({ exit_at, run_id }: typeof all[number]) => exit_at + ":" + run_id;
    const found = cursor ? all.findIndex(row => key(row) === cursor) : -1;
    if (cursor && found < 0) return c.json({ error: "invalid_cursor" }, 400);
    const items = all.slice(found + 1, found + 1 + limit);
    const last = items.at(-1);
    return c.json({ items, next_cursor: last && found + 1 + limit < all.length ? key(last) : null });
  });
  app.get("/risk-config", async c => {
    if (options.readOnly) return c.json({ config: defaultRisk, as_of: null, actor: null, editable: false });
    const revision = await readRisk(options.riskPath);
    return c.json(revision ? { ...revision, editable: true } : { config: defaultRisk, as_of: null, actor: null, editable: true });
  });
  app.post("/risk-config", async c => {
    if (options.readOnly) return c.json({ error: "configure_the_worker_api_to_edit_risk" }, 503);
    const raw = await c.req.json().catch(() => null);
    const risk = riskConfigSchema.safeParse(raw);
    if (!risk.success) return c.json({ error: "invalid_risk_config", issues: risk.error.issues }, 400);
    const revision = await appendRisk(options.riskPath, { as_of: Date.now(), actor: options.actor ?? "operator", config: risk.data });
    return c.json({ ...revision, editable: true }, 201);
  });
  return app;
}
