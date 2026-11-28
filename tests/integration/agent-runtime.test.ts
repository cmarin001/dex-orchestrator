import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { HermesAgentRuntime } from "../../src/agent-runtime/hermes.js";
import { MockAgentRuntime, NativeAgentRuntime, NoopAgentRuntime } from "../../src/agent-runtime/native.js";
import { researchRuntime } from "../../src/agent-runtime/composition.js";

const workflow={id:randomUUID(),kind:"trade_review",question:"Summarize approved audit evidence"} as const;

test("research runtimes use a shared advisory contract and Hermes stays loopback",async()=>{
  const runtimes=[
    new HermesAgentRuntime("http://127.0.0.1:8642","fixture-model","fixture-key",500,async(url,options)=>{
      assert.equal(String(url),"http://127.0.0.1:8642/v1/chat/completions");
      const headers=new Headers(options?.headers);
      assert.equal(headers.get("x-request-id"),workflow.id);
      assert.equal(headers.get("authorization"),"Bearer fixture-key");
      assert.equal(options?.redirect,"error");
      const body=JSON.parse(String(options?.body));
      assert.equal(body.model,"fixture-model");
      assert.equal("tools" in body,false);
      return Response.json({choices:[{finish_reason:"stop",message:{content:"summary"}}]});
    }),
    new NativeAgentRuntime(async request=>{
      assert.equal(request.output,"text");
      assert.deepEqual(request.tools,[]);
      return {content:"summary",toolCalls:[]};
    }),
    new MockAgentRuntime(()=> "summary"),
  ];
  for (const runtime of runtimes) {
    assert.deepEqual(await runtime.run(workflow),{workflowId:workflow.id,runtime:runtime.id,status:"completed",text:"summary"});
  }
  assert.throws(()=>new HermesAgentRuntime("https://external.example.test","fixture","fixture"),/configuration/);
  assert.deepEqual(await new NoopAgentRuntime().run(workflow),{workflowId:workflow.id,runtime:"noop",status:"abstained"});
  assert.equal((await (await researchRuntime({}))(workflow)).runtime,"noop");
});

test("Hermes requests with untrusted tool proposals are rejected",async()=>{
  const runtime=new HermesAgentRuntime("http://127.0.0.1:8642","fixture","fixture",500,async()=>Response.json({
    choices:[{finish_reason:"stop",message:{content:"summary",tool_calls:[{function:{name:"place_order"}}]}}],
  }));
  await assert.rejects(runtime.run(workflow),/schema_mismatch/);
});

test("the real stdio MCP entry point enforces a dedicated read-only harness identity",async t=>{
  const {Client}=await import("@modelcontextprotocol/sdk/client/index.js");
  const {StdioClientTransport}=await import("@modelcontextprotocol/sdk/client/stdio.js");
  const {mkdtemp,rm}=await import("node:fs/promises");
  const {tmpdir}=await import("node:os");
  const {join}=await import("node:path");
  const {fileURLToPath}=await import("node:url");
  const root=await mkdtemp(join(tmpdir(),"dex-hermes-stdio-"));
  t.after(()=>rm(root,{force:true,recursive:true}));
  const client=new Client({name:"research-stdio-test",version:"1"});
  const cwd=fileURLToPath(new URL("../../",import.meta.url));
  const transport=new StdioClientTransport({command:process.execPath,args:["--import","tsx","src/mcp/server.ts"],cwd,stderr:"pipe",
    env:{MCP_PROFILE:"harness",DASHBOARD_OPERATOR:"hermes-research",AUDIT_PATH:join(root,"journal.jsonl"),
      RISK_CONFIG_PATH:join(root,"risk.jsonl"),CONTROL_INBOX_PATH:join(root,"control")}});
  await client.connect(transport);
  try {
    const {tools}=await client.listTools();
    assert.ok(tools.some(tool=>tool.name==="get_status"));
    assert.ok(tools.every(tool=>tool.annotations?.readOnlyHint===true));
    assert.equal((await client.callTool({name:"get_status"})).isError ?? false,false);
    assert.equal((await client.callTool({name:"queue_controls_pause"})).isError,true);
    assert.equal((await client.callTool({name:"get_wallet_key_source"})).isError,true);
  } finally { await client.close(); }
});
