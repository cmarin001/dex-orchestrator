import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createDashboardApi } from "../../src/dashboard-api/routes.js";
import { createControl } from "../../src/control/service.js";
import { reflectionCatalog } from "../../src/introspection/catalog.generated.js";
import { reflectionToolName } from "../../src/introspection/reflection.js";
import { createMcp } from "../../src/mcp/tools.js";
import type { JournalEvent } from "../../src/logging/types.js";

const events: JournalEvent[] = [
  { at: "2026-01-01T00:00:00.000Z", stage: "example", status: "ok", gaps: [],
    detail: { source_path: "src/wallet/signer.ts", token: "private-fixture" } },
  { at: "2026-01-01T00:01:00.000Z", stage: "example", status: "ok", gaps: [], detail: "src/wallet/signer.ts" },
];
const options = { token: "fixture", auditPath: "unused", riskPath: "unused", initialCents: 1, events: async () => events };
const app = createDashboardApi(options);
const headers = { Authorization: "Bearer fixture" };

test("every reflection has an authenticated fetch and an equivalent approved MCP read", async t => {
  const server = createMcp(createControl(options), "fixture", true);
  const client = new Client({ name: "reflection-test", version: "1.0.0" });
  const [remote, local] = InMemoryTransport.createLinkedPair();
  await server.connect(local);
  await client.connect(remote);
  t.after(async () => { await client.close(); await server.close(); });
  const tools = new Set((await client.listTools()).tools.map(tool => tool.name));
  assert.equal(reflectionCatalog.length, 286);
  assert.equal(tools.size - [...tools].filter(name => !name.startsWith("introspect_")).length, 273);
  for (const entry of reflectionCatalog) {
    const res = await app.fetch(new Request("http://localhost" + entry.route, { headers }));
    assert.equal(res.status, 200, entry.route);
    const body = await res.json();
    assert.equal(body.path, entry.path);
    assert.equal(body.revision, entry.revision);
    assert.ok(!Object.hasOwn(body, "mcp_allowed"));
    const name = reflectionToolName(entry);
    assert.equal(tools.has(name), entry.mcp_allowed, name);
    if (entry.mcp_allowed) {
      const mirror = await client.callTool({ name, arguments: {} });
      assert.ok(!mirror.isError, name);
      assert.deepEqual(mirror.structuredContent, body, name);
    }
  }
});

test("reflection validates projection and returns only attributed, redacted audit metadata", async () => {
  const path = "/api/v1/introspect/wallet/signer.ts";
  assert.equal((await app.request(path)).status, 401);
  assert.equal((await app.request(path + "?fields=secret", { headers })).status, 400);
  assert.equal((await app.request(path + "?fields=path&fields=module", { headers })).status, 400);
  assert.equal((await app.request(path, { headers, method: "POST" })).status, 404);
  assert.equal((await app.request(path + "/invoke", { headers, method: "POST" })).status, 404);
  assert.equal((await app.request("/api/v1/introspect/root/.env", { headers })).status, 404);
  const result = await app.request(path + "?fields=path&expand=audit_tail&verbose=true", { headers });
  const body = await result.json();
  assert.deepEqual(Object.keys(body).sort(), ["audit_tail", "path", "provenance"]);
  assert.deepEqual(body.audit_tail, [{ at: events[0]!.at, status: "ok" }]);
  assert.ok(!JSON.stringify(body).includes("private-fixture"));
  const schema = await (await app.request("/api/v1/introspect/strategies/builtin/breakout-15m.ts?fields=schema", { headers })).json();
  assert.ok(schema.schema?.params?.properties?.lookbackMin);
});
