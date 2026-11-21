import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createControl } from "../control/service.js";
import { createMcpHttp } from "./http.js";
import { createMcp } from "./tools.js";
import { secretText } from "../config/secrets.js";

const env = process.env;
const control = createControl({
  auditPath:env.AUDIT_PATH ?? "data/audit.jsonl",
  riskPath:env.RISK_CONFIG_PATH ?? "data/risk-config.jsonl",
  inboxPath:env.CONTROL_INBOX_PATH,
});
const actor = env.DASHBOARD_OPERATOR || "operator";
if (process.argv.includes("--http")) {
  const port = Number(env.MCP_PORT ?? 8788);
  const host = env.MCP_HOST ?? "127.0.0.1";
  const hosts = env.MCP_ALLOWED_HOSTS?.split(",").map(host => host.trim()) ?? [host + ":" + port];
  createMcpHttp(control,await secretText(env,"DASHBOARD_API_TOKEN") ?? "",actor,hosts).listen(port,host);
} else {
  process.env.MCP_STDIO_LOGS = "true";
  await createMcp(control,actor).connect(new StdioServerTransport());
}
