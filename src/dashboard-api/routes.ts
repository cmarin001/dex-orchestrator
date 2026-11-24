import { isFill, isClose } from "../logging/types.js";
import { tradeKey } from "../../schemas/common.js";
import { equityCurveSchema } from "../../schemas/equity-curve.js";
import { Hono } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
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
import { dashboardAccess, type DashboardAuthEnv } from "./auth.js";
import { dashboardJwt, sensitiveScope } from "./jwt.js";
import { walletOverview } from "./wallets.js";
import { reflectionCatalog } from "../introspection/catalog.generated.js";
import { reflect, reflectionInput, reflectionPaths } from "../introspection/reflection.js";
import { checkGrants, discoverCapabilities, grantInput } from "../harness/policy.js";
import { disarmInput, safetyActions, safetyInput } from "../control/safety.js";
import { appendApiLog } from "../logging/api-log.js";
import { dirname, join } from "node:path";
import type { Context } from "hono";

export const dashboardRoutes = new Set(["/permissions", "/harness/capabilities", "/health", "/equity", "/journal", "/live-view", "/live-view/stream", "/trades", "/risk-config"]);
const apiPaths = new Set([...["health","status","positions","equity","audit","candidates","risk","wallets","system/health"],
  ...safetyActions.map(name => "controls/" + name),
  ...Object.keys(controlInputs).map(name => "controls/" + name)].map(name => "/api/v1/" + name));

const querySchema = z.object({
  from: z.iso.date().optional(), to: z.iso.date().optional(), run_id: z.string().optional(),
  token: z.string().optional(), cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export function createDashboardApi(options: { token?: string; jwt?: ReturnType<typeof dashboardJwt>; auditPath: string; riskPath: string;
  initialCents: number; deployHealth?: { version: string; intervalMs: number }; actor?: string; origin?: string; events?: () => Promise<JournalEvent[]>; inboxPath?: string; apiLogPath?: string }) {
  const app = new Hono<DashboardAuthEnv>();
  const requireElevated = (c: Context<DashboardAuthEnv>) => {
    if (!options.jwt) return;
    const identity = c.get("dashboardIdentity");
    if (!identity?.scopes.has(sensitiveScope)) return c.json({ error: "insufficient_scope" }, 403);
    if (!options.jwt.recentMfa(identity)) return c.json({ error: "recent_mfa_required" }, 403);
  };
  const control = createControl(options);
  app.use("*", (c, next) => logHttp(dashboardRoutes.has(c.req.path) || apiPaths.has(c.req.path) || reflectionPaths.has(c.req.path) ? c.req.path : "unknown", c.req.method,
    async () => { await next(); return c.res; }));
  if (options.origin) app.use("*", cors({ origin: options.origin, allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "OPTIONS"] }));
  if (options.origin) app.use("*", cors({ origin: options.origin, allowHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
    allowMethods: ["GET", "POST", "OPTIONS"] }));
  app.use("*", async (c, next) => { c.header("Cache-Control", "no-store"); await next(); });
  const events = options.events ?? (() => readJournal(options.auditPath, true));
  const loopback = (c: Context<DashboardAuthEnv>) => {
    const peer = getConnInfo(c).remote.address;
    return peer === "127.0.0.1" || peer === "::1" || peer === "::ffff:127.0.0.1";
  };
  app.get("/api/v1/health", async (c, next) => {
    if (!options.deployHealth || c.req.header("Authorization") !== undefined ||
        c.req.header("X-Forwarded-For") !== undefined || c.req.header("X-Real-IP") !== undefined ||
        c.req.header("Forwarded") !== undefined || c.req.header("X-Dex-Proxy") !== undefined || !loopback(c)) return next();
    let last_cycle_at: string | null = null;
    const loop_interval_sec = options.deployHealth.intervalMs / 1000;
    let journal_readable = false;
    try {
      last_cycle_at = (await control.health()).last_cycle_at;
      journal_readable = true;
    } catch (error) {
      log("warn", "dashboard.deploy_probe_failed", {failure_kind:failureKind(error)});
    }
    return c.json({ ok: journal_readable, version: options.deployHealth.version,
      last_cycle_at, journal_readable, loop_interval_sec }, journal_readable ? 200 : 503);
  });
  app.get("/internal/health", async c => {
    if (!loopback(c)) {
      return c.json({ error: "not_found" }, 404);
    }
    await control.health();
    return c.json({ status: "ok" });
  });
  app.use("*", dashboardAccess(options));
  app.use("*", bodyLimit({ maxSize: 16_384, onError: c => c.json({error:"request_too_large"},413) }));
  app.onError((error, c) => { log("error", "dashboard.handler_failed", { failure_kind: failureKind(error) }); return c.json({ error: "dashboard_data_unavailable" }, 503); });
  for (const entry of reflectionCatalog) {
    app.get(entry.route, async c => {
      const queries = c.req.queries();
      const parsed = reflectionInput.safeParse(c.req.query());
      if (!parsed.success || Object.values(queries).some(values => values.length !== 1)) {
        return c.json({ error: "invalid_reflection_query" }, 400);
      }
      return c.json(await reflect(entry, parsed.data, events));
    });
  }
  app.get("/harness/capabilities", async c => {
    const grants = await control.harnessGrants.read(c.get("dashboardActor"));
    return c.json({ tools: discoverCapabilities(grants) });
  });
  app.put("/permissions", async c => {
    const input = grantInput.safeParse(await c.req.json().catch(() => null));
    if (!input.success) return c.json({ error: "INVALID_PERMISSIONS" }, 400);
    const error = checkGrants(input.data.grants);
    if (error) return c.json({ error }, error === "UNKNOWN_TOOL" ? 400 : 403);
    const denied = requireElevated(c);
    if (denied) return denied;
    await control.harnessGrants.replace(c.get("dashboardActor"), input.data.grants);
    return c.json(input.data);
  });
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
    const denied = requireElevated(c);
    if (denied) return denied;
    const request = await control.submit("risk", {config:risk.data}, c.get("dashboardActor"));
    return c.json({ ...await control.risk(), editable:true, request }, 202);
  });
  for (const name of ["health","status","positions","equity","candidates","risk"] as const) {
    app.get("/api/v1/" + name, async c => c.json(await control[name]()));
  }
  app.get("/api/v1/system/health", async c => c.json(await control.systemHealth()));
  const wallets = walletOverview(options.auditPath);
  app.get("/api/v1/wallets", async c => c.json(await wallets()));
  app.get("/api/v1/audit", async c => {
    const input = await control.audit(c.req.query()).catch(error => {
      if (error instanceof z.ZodError) return null;
      throw error;
    });
    return input ? c.json(input) : c.json({error:"invalid_filters"},400);
  });
  for (const action of safetyActions) {
    const path = "/api/v1/controls/" + action;
    app.post(path, async c => {
      const started = startTimer();
      const raw = await c.req.text();
      let body: unknown;
      try { body = raw ? JSON.parse(raw) : {}; }
      catch { return c.json({ error: "invalid_json" }, 400); }
      const key = c.req.header("Idempotency-Key");
      if (key && typeof body === "object" && body !== null && !Array.isArray(body)) {
        const requested = (body as Record<string, unknown>).request_id;
        if (requested !== undefined && requested !== key) return c.json({ error: "idempotency_key_mismatch" }, 409);
        body = { ...body, request_id: key };
      }
      const input = (action === "disarm-signer" ? disarmInput : safetyInput).safeParse(body);
      if (!input.success) return c.json({ error: "invalid_safety_control" }, 400);
      if (action !== "emergency-stop") {
        const denied = requireElevated(c);
        if (denied) return denied;
      }
      const actor = c.get("dashboardActor");
      const { activated, ...receipt } = await control.safety.activate(action, actor, input.data.request_id);
      const status = activated ? 202 : 200;
      await appendApiLog(options.apiLogPath ?? join(dirname(options.auditPath), "api-log.jsonl"), {
        surface: "rest", actor, method: "POST", path, status, request_id: receipt.request_id, duration_ms: elapsed(started),
      });
      return c.json(receipt, status);
    });
  }
  for (const name of Object.keys(controlInputs) as Array<keyof typeof controlInputs>) {
    app.post("/api/v1/controls/" + name, async c => {
      const text = await c.req.text();
      let body: unknown;
      try { body = text ? JSON.parse(text) : {}; }
      catch { return c.json({error:"invalid_json"},400); }
      const input = controlInputs[name].safeParse(body);
      if (!input.success) return c.json({error:"invalid_control"},400);
      if (name === "risk" || (name === "live-execution" && "enabled" in input.data && input.data.enabled)) {
        const denied = requireElevated(c);
        if (denied) return denied;
      }
      try {
        const result = await control.submit(name,body,c.get("dashboardActor"));
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
      const denied = requireElevated(c);
      if (denied) return denied;
      try {
        const result=await control.phase3.mutate(action,body,c.get("dashboardActor"));
        return c.json(result,result.state==="queued"?202:200);
      } catch (error) {
        if (error instanceof ControlConflict) return c.json({error:error.message},409);
        throw error;
      }
    });
  }
  return app;
}
