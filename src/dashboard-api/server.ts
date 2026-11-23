import { serve } from "@hono/node-server";
import { log } from "../logging/operational.js";
import { createDashboardApi } from "./routes.js";
import { secretText } from "../config/secrets.js";

import { dashboardAuthMode, dashboardJwt } from "./jwt.js";

const env = process.env;
const mode = dashboardAuthMode(env.DASHBOARD_AUTH_MODE);
const token = mode === "auth0" ? undefined : await secretText(env, "DASHBOARD_API_TOKEN");
if (mode !== "auth0" && !token) throw new Error("DASHBOARD_API_TOKEN is required in legacy and dual modes");
const jwt = mode === "legacy" ? undefined : dashboardJwt({
  issuer: env.AUTH0_ISSUER ?? "",
  audience: env.AUTH0_AUDIENCE ?? "",
  clientId: env.AUTH0_CLIENT_ID ?? "",
  mfaClaim: env.AUTH0_MFA_CLAIM ?? "",
  maxMfaAge: Number(env.DASHBOARD_MFA_MAX_AGE_SEC ?? 300),
});
log("info", "dashboard.auth_configured", { reason: mode });
const api = createDashboardApi({
  token, jwt,
  auditPath: process.env.AUDIT_PATH ?? "data/audit.jsonl",
  riskPath: process.env.RISK_CONFIG_PATH ?? "data/risk-config.jsonl",
  inboxPath: process.env.CONTROL_INBOX_PATH,
  apiLogPath: process.env.API_LOG_PATH,
  initialCents: Number(process.env.INITIAL_EQUITY_CENTS ?? 100000),
  origin: process.env.DASHBOARD_ORIGIN,
  deployHealth: { version: env.BUILD_VERSION ?? "dev", intervalMs: Number(env.LOOP_INTERVAL_MS ?? 90_000) },
  actor: process.env.DASHBOARD_OPERATOR || "operator",
});
const server = serve({ fetch: api.fetch, hostname: process.env.DASHBOARD_API_HOST ?? "127.0.0.1", port: Number(process.env.DASHBOARD_API_PORT ?? 8787) },
  () => log("info", "dashboard.started"));
server.on("error", () => { log("error", "dashboard.server_error"); process.exitCode = 1; });
server.on("close", () => log("info", "dashboard.stopped"));
