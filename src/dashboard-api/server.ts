import { serve } from "@hono/node-server";
import { createDashboardApi } from "./routes.js";

const api = createDashboardApi({
  token: process.env.DASHBOARD_API_TOKEN ?? "",
  auditPath: process.env.AUDIT_PATH ?? "data/audit.jsonl",
  riskPath: process.env.RISK_CONFIG_PATH ?? "data/risk-config.jsonl",
  initialCents: Number(process.env.INITIAL_EQUITY_CENTS ?? 100000),
  origin: process.env.DASHBOARD_ORIGIN,
  actor: process.env.DASHBOARD_OPERATOR || "operator",
});
serve({ fetch: api.fetch, port: Number(process.env.DASHBOARD_API_PORT ?? 8787) });
