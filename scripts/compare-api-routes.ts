import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createControl } from "../src/control/service.js";
import { createDashboardApi } from "../src/dashboard-api/routes.js";
import { reflectionCatalog } from "../src/introspection/catalog.generated.js";
import { reflectionToolName } from "../src/introspection/reflection.js";
import { createMcp } from "../src/mcp/tools.js";
import { inventory } from "./reflection-inventory.mjs";

const plan = inventory();
const rest = new Map([
  ...plan.reflection.map(([id, , path]) => [id!, "GET " + path] as const),
  ...plan.capability.map(([id, route]) => [id!, route!] as const),
]);
const tools = new Map(plan.tools.map(([, id, name]) => [id!, name!]));
const withoutTool = [...rest].filter(([id]) => !tools.has(id)).map(([, route]) => route).sort();
const allowed = reflectionCatalog.filter(entry => !entry.mcp_allowed).map(entry => "GET " + entry.route).sort();
const print = (label: string, lines: readonly string[]) => {
  console.log(`${label} (${lines.length})\n${lines.join("\n") || "(none)"}`);
};
print("Approved REST routes with no MCP tool", withoutTool);
assert.deepEqual(withoutTool, allowed);
assert.equal(allowed.length, 13);
assert.equal(rest.size, plan.reflection.length + plan.capability.length);
assert.equal(tools.size, plan.tools.length);
assert.deepEqual(plan.trace.map(([, , endpoint]) => endpoint).sort(), [...rest.keys()].sort());
assert([...tools].every(([id]) => rest.has(id)));
assert.equal(new Set(rest.values()).size, rest.size);
assert.equal(new Set(tools.values()).size, tools.size);

const options = { token: "unused", auditPath: "unused", riskPath: "unused", initialCents: 1, events: async () => [] };
const api = createDashboardApi(options);
const actualRest = new Set(api.routes.filter(route => route.method !== "ALL").map(route => route.method + " " + route.path));
const server = createMcp(createControl(options), "route-comparison", true);
const client = new Client({ name: "route-comparison", version: "1.0.0" });
const [peer, transport] = InMemoryTransport.createLinkedPair();
await server.connect(transport);
await client.connect(peer);
try {
  const actualTools = new Set((await client.listTools()).tools.map(tool => tool.name));
  print("Planned REST routes absent at runtime", [...rest.values()].filter(route => !actualRest.has(route)));
  print("Runtime REST routes outside the plan", [...actualRest].filter(route => ![...rest.values()].includes(route)));
  print("Planned MCP names absent in the read-only runtime profile", [...tools.values()].filter(name => !actualTools.has(name)));
  print("Runtime MCP names outside the plan", [...actualTools].filter(name => ![...tools.values()].includes(name)));
  const expectedReflection = reflectionCatalog.filter(entry => entry.mcp_allowed).map(reflectionToolName).sort();
  const registeredReflection = [...actualTools].filter(name => name.startsWith("introspect_")).sort();
  assert.deepEqual(registeredReflection, expectedReflection);
  assert.deepEqual([...actualRest].filter(route => route.startsWith("GET /api/v1/introspect/")).sort(),
    plan.reflection.map(([, , path]) => "GET " + path).sort());
  for (const entry of reflectionCatalog) {
    assert.equal(tools.get(plan.reflection.find(([, , route]) => route === entry.route)?.[0] ?? ""),
      entry.mcp_allowed ? reflectionToolName(entry) : undefined);
  }
} finally {
  await client.close();
  await server.close();
}
