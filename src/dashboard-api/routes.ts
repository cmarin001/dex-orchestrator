import { isFill, isClose } from "../logging/types.js";
import { tradeKey } from "../../schemas/common.js";
import { equityCurveSchema } from "../../schemas/equity-curve.js";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { riskConfigSchema } from "../../schemas/risk-config.js";
import { elapsed, failureKind, log, logHttp, startTimer } from "../logging/operational.js";
import { liveViews } from "../live/publisher.js";
import { projectTradeHistory } from "../logging/projections/trade-history.js";
import { readJournal } from "../logging/logger.js";
import type { JournalEvent } from "../logging/types.js";
import { createControl, controlInputs } from "../control/service.js";
import { ControlConflict } from "../control/commands.js";
import { changes, reads, type Change } from "../control/phase3.js";
import { bearerAuth } from "./auth.js";

export const dashboardRoutes = new Set(["/health", "/equity", "/journal", "/live-view", "/live-view/stream", "/trades", "/risk-config"]);
const apiPaths = new Set([...["health","status","positions","equity","audit","candidates","risk"],
  ...Object.keys(controlInputs).map(name => "controls/" + name)].map(name => "/api/v1/" + name));

const querySchema = z.object({
  from: z.iso.date().optional(), to: z.iso.date().optional(), run_id: z.string().optional(),
  token: z.string().optional(), cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export function createDashboardApi(options: { token: string; auditPath: string; riskPath: string;
  initialCents: number; actor?: string; origin?: string; events?: () => Promise<JournalEvent[]>; inboxPath?: string }) {
  const app = new Hono();
  const control = createControl(options);
  app.use("*", (c, next) => logHttp(dashboardRoutes.has(c.req.path) || apiPaths.has(c.req.path) ? c.req.path : "unknown", c.req.method,
    async () => { await next(); return c.res; }));
  if (options.origin) app.use("*", cors({ origin: options.origin, allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "OPTIONS"] }));
  app.use("*", async (c, next) => { c.header("Cache-Control", "no-store"); await next(); });
  app.use("*", bearerAuth(options.token));
  app.use("*", bodyLimit({ maxSize: 16_384, onError: c => c.json({error:"request_too_large"},413) }));
  const events = options.events ?? (() => readJournal(options.auditPath, true));
  app.onError((error, c) => { log("error", "dashboard.handler_failed", { failure_kind: failureKind(error) }); return c.json({ error: "dashboard_data_unavailable" }, 503); });
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
    const started = startTimer();
    log("debug", "dashboard.stream_opened");
    return streamSSE(c, async stream => {
      let count = 0;
      try {
        while (count < 10 && !stream.aborted) {
          await stream.writeSSE({ event: "live-view",
            data: JSON.stringify(liveViews(await events()).filter(view => !token || view.token === token)) });
          count += 1;
          await stream.sleep(5000);
        }
      } finally {
        log("debug", "dashboard.stream_closed", { count, duration_ms: elapsed(started) });
      }
    }, async (error, stream) => {
      log("warn", "dashboard.stream_failed", { failure_kind: failureKind(error) });
      await stream.writeSSE({ event: "unavailable", data: "dashboard_data_unavailable" });
    });
  });
  app.get("/equity", async c => {
    const journal = await events();
    const realized = projectTradeHistory(journal).reduce((sum, row) => sum + Math.round(row.pnl_usd * 100), 0);
    const open = new Map<string, number>();
    for (const e of journal) {
      if (isFill(e.status) && e.position) open.set(tradeKey(e.position), e.position.cost_cents);
      if (isClose(e.status) && e.position) open.delete(tradeKey(e.position));
    }
    const last = journal.findLast(event => event.stage === "equity-curve" && event.status === "ok");
    const published = equityCurveSchema.safeParse(last?.detail);
    return c.json({ current_equity: published.success ? Math.round(published.data.equity_usd * 100) : null,
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
  app.get("/risk-config", async c => c.json({ ...await control.risk(), editable: true }));
  app.post("/risk-config", async c => {
    const risk = riskConfigSchema.safeParse(await c.req.json().catch(() => null));
    if (!risk.success) return c.json({ error: "invalid_risk_config" }, 400);
    const request = await control.submit("risk", {config:risk.data}, options.actor ?? "operator");
    return c.json({ ...await control.risk(), editable:true, request }, 202);
  });
  for (const name of ["health","status","positions","equity","candidates","risk"] as const) {
    app.get("/api/v1/" + name, async c => c.json(await control[name]()));
  }
  app.get("/api/v1/audit", async c => {
    const input = await control.audit(c.req.query()).catch(error => {
      if (error instanceof z.ZodError) return null;
      throw error;
    });
    return input ? c.json(input) : c.json({error:"invalid_filters"},400);
  });
  for (const name of Object.keys(controlInputs) as Array<keyof typeof controlInputs>) {
    app.post("/api/v1/controls/" + name, async c => {
      const text = await c.req.text();
      let body: unknown;
      try { body = text ? JSON.parse(text) : {}; }
      catch { return c.json({error:"invalid_json"},400); }
      if (!controlInputs[name].safeParse(body).success) return c.json({error:"invalid_control"},400);
      try {
        const result = await control.submit(name,body,options.actor ?? "operator");
        return c.json(result,result.state === "queued" ? 202 : 200);
      } catch (error) {
        if (error instanceof ControlConflict) return c.json({error:error.message},409);
        throw error;
      }
    });
  }
  for (const name of reads) app.get("/api/v1/" + name, async c => c.json(await control.phase3.read(name)));
  for (const name of ["providers","strategies"] as const) {
    app.get("/api/v1/" + name + "/:id",async c=>{
      const result=await control.phase3.read(name,c.req.param("id"));
      const items="items" in result ? result.items : [];
      const item=Array.isArray(items) ? items[0] : undefined;
      return item ? c.json(item) : c.json({error:"not_found"},404);
    });
  }
  const writes:Array<[string,Change]>=[
    ["/mode","set_mode"],["/chain","set_chain_routing"],["/controls/chain","set_chain_routing"],["/budget","set_budget"],
    ["/providers/:id/enable","enable_provider"],["/providers/:id/disable","disable_provider"],
    ["/strategies/:id/enable","enable_strategy"],["/strategies/:id/disable","disable_strategy"],
    ["/strategies/:id/params","update_strategy_params"],["/strategies/reload","reload_strategies"],
    ["/controls/approve/:id","approve_signal"],["/controls/reject/:id","reject_signal"],
  ];
  for (const [path,action] of writes) {
    app.post("/api/v1"+path,async c=>{
      const text=await c.req.text();
      let raw:unknown;
      try {raw=text?JSON.parse(text):{};} catch {return c.json({error:"invalid_json"},400);}
      if (!raw || typeof raw!=="object" || Array.isArray(raw)) return c.json({error:"invalid_control"},400);
      const id=c.req.param("id");
      let body={...raw,...(id ? {id} : {})};
      if (["set_mode","set_chain_routing","set_budget"].includes(action) && !("config" in body)) {
        const {request_id,reason,...config}=body as Record<string,unknown>;
        body={request_id,...(action==="set_mode"?{reason}:{}),config} as typeof body;
      }
      if (!changes[action].schema.safeParse(body).success) return c.json({error:"invalid_control"},400);
      try {
        const result=await control.phase3.mutate(action,body,options.actor ?? "operator");
        return c.json(result,result.state==="queued"?202:200);
      } catch (error) {
        if (error instanceof ControlConflict) return c.json({error:error.message},409);
        throw error;
      }
    });
  }
  return app;
}
