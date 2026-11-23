import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createControl } from "../control/service.js";
import { createMcpHttp } from "./http.js";
import { createMcp } from "./tools.js";
import { secretText } from "../config/secrets.js";

import { dashboardAuthMode } from "../dashboard-api/jwt.js";

const env = process.env;
const authMode = dashboardAuthMode(env.DASHBOARD_AUTH_MODE);
const control = createControl({
  auditPath:env.AUDIT_PATH ?? "data/audit.jsonl",
  riskPath:env.RISK_CONFIG_PATH ?? "data/risk-config.jsonl",
  inboxPath:env.CONTROL_INBOX_PATH,
});
const actor = env.DASHBOARD_OPERATOR || "operator";
const harness = env.MCP_PROFILE === "harness";
if (process.argv.includes("--http")) {
  if (harness) throw new Error("The harness profile requires local stdio");
  const port = Number(env.MCP_PORT ?? 8788);
  const host = env.MCP_HOST ?? "127.0.0.1";
  const hosts = env.MCP_ALLOWED_HOSTS?.split(",").map(host => host.trim()) ?? [host + ":" + port];
  createMcpHttp(control,authMode === "auth0" ? "" : await secretText(env,"DASHBOARD_API_TOKEN") ?? "",actor,hosts,authMode !== "legacy").listen(port,host);
} else {
  process.env.MCP_STDIO_LOGS = "true";
  const profile = harness ? { grants: await control.harnessGrants.read(actor) } : undefined;
  await createMcp(control,actor,authMode !== "legacy",profile).connect(new StdioServerTransport());
}
