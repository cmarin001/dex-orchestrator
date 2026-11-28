import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { workflowSchema } from "./contract.js";
import { researchRuntime } from "./composition.js";
import { log } from "../logging/operational.js";
import { ProviderError } from "../providers/types.js";

process.env.MCP_STDIO_LOGS="true";
const abort=new AbortController();
process.once("SIGINT",()=>abort.abort());
process.once("SIGTERM",()=>abort.abort());
try {
  const payload=JSON.parse(await readFile(process.argv[2] ?? "/dev/stdin","utf8")) as Record<string,unknown>;
  const workflow=workflowSchema.parse({id:randomUUID(),...payload});
  const run=await researchRuntime(process.env);
  process.stdout.write(JSON.stringify(await run(workflow,abort.signal))+"\n");
} catch(error) {
  log("error","research.failed",{failure_kind:error instanceof ProviderError?error.kind:"invalid_config_or_workflow"});
  process.exitCode=1;
}
