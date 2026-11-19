import { serve } from "@hono/node-server";
import { log } from "../logging/operational.js";
import { createDashboardApi } from "./routes.js";

const token = process.env.DASHBOARD_API_TOKEN ?? "";
if (!token.trim()) log("error", "dashboard.start_failed", { reason: "missing_api_token" });
const api = createDashboardApi({
  token,
  auditPath: process.env.AUDIT_PATH ?? "data/audit.jsonl",
  riskPath: process.env.RISK_CONFIG_PATH ?? "data/risk-config.jsonl",
  initialCents: Number(process.env.INITIAL_EQUITY_CENTS ?? 100000),
  origin: process.env.DASHBOARD_ORIGIN,
  actor: process.env.DASHBOARD_OPERATOR || "operator",
});
const server = serve({ fetch: api.fetch, port: Number(process.env.DASHBOARD_API_PORT ?? 8787) },
  () => log("info", "dashboard.started"));
server.on("error", () => { log("error", "dashboard.server_error"); process.exitCode = 1; });
server.on("close", () => log("info", "dashboard.stopped"));
