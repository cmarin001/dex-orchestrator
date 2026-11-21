import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodObject } from "zod";
import { empty, ControlConflict } from "../control/commands.js";
import { auditQuery, controlInputs, type ControlService } from "../control/service.js";
import { failureKind, log } from "../logging/operational.js";

export function createMcp(control: ControlService, actor: string) {
  const server = new McpServer({ name:"dex-orchestrator", version:"1.0.0" });
  function tool(name: string, description: string, inputSchema: ZodObject, readOnlyHint: boolean,
    call: (input: unknown) => Promise<Record<string, unknown>>) {
    server.registerTool(name, { description, inputSchema, annotations:{readOnlyHint} }, async input => {
      try {
        const result = await call(input);
        return { structuredContent:result, content:[{type:"text",text:JSON.stringify(result)}] };
      } catch (error) {
        const message = error instanceof ControlConflict ? error.message : "Control data unavailable";
        log("warn","mcp.tool_failed",{stage:name,failure_kind:failureKind(error)});
        return {isError:true,content:[{type:"text",text:message}]};
      }
    });
  }
  tool("get_status","Read the paper worker, breaker and entry pause state.",empty,true,control.status);
  tool("list_positions","Read open paper positions and their latest recorded marks.",empty,true,control.positions);
  tool("get_equity","Read published paper equity, drawdown and recent history.",empty,true,control.equity);
  tool("get_recent_audit","Read paginated paper audit events.",auditQuery,true,control.audit);
  tool("get_candidates","Read the last scan and watched targets.",empty,true,control.candidates);
  tool("get_risk","Read the current risk configuration.",empty,true,control.risk);
  const controls = [
    ["pause_entries","pause","Queue a pause of new paper entries. Exits continue."],
    ["resume_entries","resume","Queue resumed paper entries subject to the usual risk and rug checks."],
    ["update_risk","risk","Queue a validated, attributed revision that affects future paper entries."],
    ["request_exit","exit","Prioritize a paper position for exit evaluation under its existing policy."],
    ["reject_token","reject","Queue a permanent block on new paper entries for a token and chain."],
  ] as const;
  for (const [name, type, description] of controls) {
    tool(name, description, controlInputs[type], false, input => control.submit(type,input,actor));
  }
  server.registerResource("audit journal", "audit://journal", {mimeType:"application/json",description:"Read-only audit tail."},
    async uri => ({contents:[{uri:uri.href,mimeType:"application/json",text:JSON.stringify(await control.audit({limit:50}))}]}));
  return server;
}
