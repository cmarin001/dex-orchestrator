import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodObject } from "zod";
import { empty, ControlConflict, receiptInput } from "../control/commands.js";
import { auditQuery, controlInputs, type ControlService } from "../control/service.js";
import { entityRoutes } from "../control/entity-reads.js";
import { changes, input, type Change } from "../control/phase3.js";
import { reflectionCatalog } from "../introspection/catalog.generated.js";
import { reflect, reflectionInput, reflectionToolName } from "../introspection/reflection.js";
import { modelReadAllowed, toolPolicy, type Grants } from "../harness/policy.js";
import { failureKind, log } from "../logging/operational.js";

export function createMcp(control: ControlService, actor: string, readOnly = false, harness?: { grants: Grants }) {
  const server = new McpServer({ name:"dex-orchestrator", version:"1.0.0" });
  function tool(name: string, description: string, inputSchema: ZodObject, readOnlyHint: boolean,
    call: (input: unknown) => Promise<Record<string, unknown>>) {
    const modelNames: Record<string, string> = { get_recent_audit: "get_audit", get_candidates: "list_candidates",
      get_risk: "get_risk_config", get_providers: "list_providers", get_chain_routing: "get_chain" };
    const exposed = harness ? modelNames[name] ?? name : name;
    if ((readOnly || harness) && !readOnlyHint) return;
    if (harness && !modelReadAllowed(exposed, harness.grants)) return;
    const label = harness ? toolPolicy(exposed)?.description ?? description : description;
    server.registerTool(exposed, { description: label, inputSchema, annotations:{readOnlyHint} }, async input => {
      if (harness && !modelReadAllowed(exposed, await control.harnessGrants.read(actor))) {
        return { isError: true, content: [{ type: "text", text: "Tool unavailable for this profile" }] };
      }
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
  for (const entry of reflectionCatalog) {
    if (entry.mcp_allowed) {
      tool(reflectionToolName(entry), "Read-only file metadata and redacted audit tail.", reflectionInput, true,
        raw => reflect(entry, reflectionInput.parse(raw), control.readEvents));
    }
  }
  for (const { tool: name, method, schema, description } of entityRoutes) {
    tool(name, description, schema, true, async raw => {
      const result = await control[method](raw);
      if (result === null) throw new ControlConflict("Unknown or ambiguous run ID");
      return result;
    });
  }
  tool("get_receipts_request_id", "Read your queued, applied or rejected worker command by its original request ID.", receiptInput, true,
    async raw => {
      const result = await control.receipt(raw, actor);
      if (!result) throw new ControlConflict("Receipt not found");
      return result;
    });
  tool("get_status","Read the paper worker, breaker and entry pause state.",empty,true,control.status);
  tool("list_positions","Read open paper positions and their latest recorded marks.",empty,true,control.positions);
  tool("get_equity","Read published paper equity, drawdown and recent history.",empty,true,control.equity);
  tool("get_recent_audit","Read paginated paper audit events.",auditQuery,true,control.audit);
  tool("get_candidates","Read the last scan and watched targets.",empty,true,control.candidates);
  tool("get_risk","Read the current risk configuration.",empty,true,control.risk);
  const controls = [
    ["set_live_execution","live-execution","Queue a switch for new live entries on a configured live worker. Protective exits and reconciliation remain eligible."],
    ["pause_entries","pause","Queue a pause of new paper entries. Exits continue."],
    ["resume_entries","resume","Queue resumed paper entries subject to the usual risk and rug checks."],
    ["queue_controls_exits_pause", "exits/pause", "Pause discretionary strategy exits. Policy-driven and manual exits remain eligible."],
    ["queue_controls_exits_resume", "exits/resume", "Resume discretionary strategy exits under the existing policy."],
    ["update_risk","risk","Queue a validated, attributed revision that affects future paper entries."],
    ["request_exit","exit","Prioritize a paper position for exit evaluation under its existing policy."],
    ["reject_token","reject","Queue a permanent block on new paper entries for a token and chain."],
  ] as const;
  for (const [name, type, description] of controls) {
    tool(name, description, controlInputs[type], false, input => control.submit(type,input,actor));
  }
  const reads = [
    ["get_providers","providers"],["list_strategies","strategies"],["get_mode","mode"],
    ["get_chain_routing","chain"],["get_budget","budget"],["get_recent_signals","signals"],
  ] as const;
  for (const [name,resource] of reads) {
    tool(name,"Read "+resource+" from the worker journal.",empty,true,()=>control.phase3.read(resource));
  }
  for (const [name,resource] of [["get_provider","providers"],["get_strategy","strategies"]] as const) {
    tool(name,"Read a single "+resource.slice(0,-1)+" by ID.",input.id,true,async raw=>{
      const {id}=input.id.parse(raw);
      const result=await control.phase3.read(resource,id);
      const items="items" in result ? result.items : [];
      if (!Array.isArray(items) || !items.length) throw new ControlConflict("Unknown "+resource.slice(0,-1));
      return items[0]!;
    });
  }
  for (const name of Object.keys(changes) as Change[]) {
    // The worker applies these on the next cycle. Approvals cannot directly submit a trade.
    tool(name,"Queue "+name.replaceAll("_"," ")+" for the next worker cycle.",changes[name].schema,false,
      raw=>control.phase3.mutate(name,raw,actor));
  }
  if (!harness) server.registerResource("audit journal", "audit://journal", {mimeType:"application/json",description:"Read-only audit tail."},
    async uri => ({contents:[{uri:uri.href,mimeType:"application/json",text:JSON.stringify(await control.audit({limit:50}))}]}));
  return server;
}
