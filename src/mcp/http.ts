import { createServer } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isAuthorized } from "../dashboard-api/auth.js";
import type { ControlService } from "../control/service.js";
import { failureKind, log } from "../logging/operational.js";
import { createMcp } from "./tools.js";

export function createMcpHttp(control: ControlService, token: string, actor: string, allowedHosts: string[], readOnly = false) {
  if (!token.trim() && !readOnly) throw new Error("DASHBOARD_API_TOKEN is required");
  return createServer(async (req, res) => {
    res.setHeader("Cache-Control","no-store");
    if (req.url !== "/mcp") { res.writeHead(404).end(); return; }
    if (!allowedHosts.includes(req.headers.host ?? "") || req.headers.origin !== undefined) {
      res.writeHead(403).end(); return;
    }
    if (!token.trim() || !isAuthorized(req.headers.authorization,token)) {
      res.writeHead(401,{"WWW-Authenticate":"Bearer"}).end(); return;
    }
    if (req.method !== "POST") { res.writeHead(405,{Allow:"POST"}).end(); return; }
    const server = createMcp(control,actor,readOnly);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator:undefined, enableJsonResponse:true });
    res.once("close", () => { void server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req,res);
    } catch (error) {
      log("error","mcp.request_failed",{failure_kind:failureKind(error)});
      if (!res.headersSent) res.writeHead(500);
      res.end();
    }
  });
}
