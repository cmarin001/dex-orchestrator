import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createMcpHttp } from "../../src/mcp/http.js";
import { reflectionCatalog } from "../../src/introspection/catalog.generated.js";
import { createMcp } from "../../src/mcp/tools.js";
import { config, controlFixture, identity, target } from "../control-fixture.js";

test("MCP tools and resource use the same reads and command receipts as REST", async t => {
  const f = await controlFixture(t);
  const server = createMcp(f.control,"desk");
  const client = new Client({name:"test",version:"1.0.0"});
  const [remote, local] = InMemoryTransport.createLinkedPair();
  await server.connect(local);
  await client.connect(remote);
  t.after(() => client.close());
  assert.equal((await client.listTools()).tools.length,37 + reflectionCatalog.filter(entry => entry.mcp_allowed).length);
  async function call(name:string,args:Record<string,unknown> = {}) {
    const result = await client.callTool({name,arguments:args});
    assert.ok(!result.isError,JSON.stringify(result));
    return result.structuredContent as Record<string,unknown>;
  }
  assert.deepEqual(await call("get_status"),await f.control.status());
  assert.deepEqual(await call("list_positions"),await f.control.positions());
  assert.deepEqual(await call("get_equity"),await f.control.equity());
  assert.deepEqual(await call("get_candidates"),await f.control.candidates());
  assert.deepEqual(await call("get_risk"),await f.control.risk());
  assert.deepEqual(await call("get_recent_audit",{limit:1}),await f.control.audit({limit:1}));
  const resource = await client.readResource({uri:"audit://journal"});
  const item = resource.contents[0];
  assert.ok(item && "text" in item);
  assert.deepEqual(JSON.parse(item.text),await f.control.audit({limit:50}));
  assert.ok((await client.callTool({name:"reject_token",arguments:{chain:"base",token:"bad"}})).isError);
  for (const [tool, args] of [
    ["pause_entries",{request_id:"p"}],["update_risk",{config}],["request_exit",{run_id:identity.run_id}],
    ["reject_token",{chain:target.chain,token:target.token}],
  ] as const) assert.equal((await call(tool,args))?.state,"queued");
  await f.drain();
  assert.equal((await call("pause_entries",{request_id:"p"}))?.state,"applied");
  assert.equal((await call("get_status"))?.entries_paused,true);
  assert.deepEqual((await call("get_risk"))?.config,config);
  await call("resume_entries");
  assert.equal((await call("set_live_execution",{request_id:"try-live",enabled:true}))?.state,"queued");
  await f.drain();
  assert.equal((await call("get_status"))?.entries_paused,false);
  assert.equal((await call("set_live_execution",{request_id:"try-live",enabled:true}))?.state,"rejected");
});

test("Streamable HTTP authenticates, checks Host and Origin, and serves SDK clients", async t => {
  const f = await controlFixture(t);
  const hosts:string[] = [];
  const server = createMcpHttp(f.control,"test","desk",hosts).listen(0,"127.0.0.1");
  t.after(() => server.close());
  await once(server,"listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const url = new URL("http://127.0.0.1:"+address.port+"/mcp");
  assert.equal((await fetch(url,{method:"POST"})).status,403);
  hosts.push(url.host);
  assert.equal((await fetch(url,{method:"POST"})).status,401);
  assert.equal((await fetch(url,{method:"POST",headers:{Origin:"https://other.test",Authorization:"Bearer test"}})).status,403);
  const client = new Client({name:"test",version:"1.0.0"});
  await client.connect(new StreamableHTTPClientTransport(url,{requestInit:{headers:{Authorization:"Bearer test"}}}));
  t.after(() => client.close());
  assert.deepEqual((await client.callTool({name:"get_status"})).structuredContent,await f.control.status());
});

test("stdio entry point reserves stdout for MCP messages", async t => {
  const f = await controlFixture(t);
  const client = new Client({name:"test",version:"1.0.0"});
  const transport = new StdioClientTransport({command:process.execPath,args:["--import","tsx","src/mcp/server.ts"],
    stderr:"pipe",env:{LOG_LEVEL:"debug",AUDIT_PATH:f.paths.auditPath,RISK_CONFIG_PATH:f.paths.riskPath,
      CONTROL_INBOX_PATH:f.paths.inboxPath}});
  t.after(() => client.close());
  await client.connect(transport);
  assert.deepEqual((await client.callTool({name:"get_status"})).structuredContent,await f.control.status());
});

test("MCP migration mode exposes only read tools", async t => {
  const f = await controlFixture(t);
  const [desktop, serverTransport] = InMemoryTransport.createLinkedPair();
  const service = createMcp(f.control, "legacy", true);
  const client = new Client({ name: "observer", version: "1.0.0" });
  t.after(async () => { await client.close(); await service.close(); });
  await service.connect(serverTransport);
  await client.connect(desktop);
  const { tools } = await client.listTools();
  assert.ok(tools.some(tool => tool.name === "get_status"));
  assert.ok(tools.every(tool => tool.annotations?.readOnlyHint === true));
  assert.equal((await client.callTool({ name: "set_live_execution", arguments: { enabled: true } })).isError, true);
  for (const name of ["queue_controls_emergency_stop", "queue_controls_flatten", "queue_controls_disarm_signer"]) {
    assert.ok(!tools.some(tool => tool.name === name));
    assert.equal((await client.callTool({ name })).isError, true);
  }
});
