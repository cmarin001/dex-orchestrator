import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test, type TestContext } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createControl } from "../../src/control/service.js";
import { createDashboardApi } from "../../src/dashboard-api/routes.js";
import { hardFloor, harnessPlan } from "../../src/harness/catalog.generated.js";
import { evaluateFixture, fixtureDigest, recordFixture, replayFixture, scoreFixture, type FixtureStep } from "../../src/harness/eval.js";
import { createMcp } from "../../src/mcp/tools.js";

const deny = ["introspect_exec_signer_ts", "introspect_wallet_key_source_ts", "get_wallet_key_source"];

async function fixture(t: TestContext) {
  const directory = await mkdtemp(join(tmpdir(), "trade-keel-harness-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const options = { token: "integration-token", auditPath: join(directory, "audit.jsonl"),
    riskPath: join(directory, "risk.jsonl"), initialCents: 100, actor: "operator", events: async () => [] };
  const api = createDashboardApi(options);
  const control = createControl(options);
  const headers = { Authorization: "Bearer integration-token", "Content-Type": "application/json" };
  const read = () => api.request("/harness/capabilities", { headers });
  const write = (grants: Record<string, string>) => api.request("/permissions", { method: "PUT", headers,
    body: JSON.stringify({ grants }) });
  return { directory, api, control, read, write };
}

test("hard-floor and catalog-denied tools are non-grantable under allow and ask", async t => {
  const { api, read, write, control } = await fixture(t);
  assert.equal((await api.request("/harness/capabilities")).status, 401);
  assert.equal(harnessPlan.length, 378);
  assert.equal(hardFloor.length, 14, "13 repository paths and the reserved raw-key name");
  const before = await read();
  const { tools } = await before.json() as { tools: Record<string, unknown>[] };
  assert.equal(before.status, 200);
  for (const name of [...deny, ...hardFloor]) {
    const metadata = tools.find(tool => tool.name === name);
    assert.equal(metadata?.grantable, false, name);
    assert.equal(metadata?.permission, "deny", name);
    for (const permission of ["allow", "ask"]) {
      const r = await write({ get_status: "deny", [name]: permission });
      assert.equal(r.status, 403, name);
      assert.deepEqual(await r.json(), { error: "HARD_FLOOR" });
      assert.deepEqual(await control.harnessGrants.read("operator"), {});
    }
  }
  const mixed = await write({ unknown_tool: "allow", [deny[0]!]: "ask" });
  assert.equal(mixed.status, 403);
  assert.deepEqual(await mixed.json(), { error: "HARD_FLOOR" });
  const rejected = await write({ queue_controls_pause: "allow" });
  assert.equal(rejected.status, 403);
  assert.deepEqual(await rejected.json(), { error: "APPROVAL_REQUIRED" });
  assert.equal((await write({ get_status: "deny", queue_controls_pause: "ask" })).status, 200);
  assert.deepEqual(await control.harnessGrants.read("operator"), { get_status: "deny", queue_controls_pause: "ask" });
});

test("model MCP exposes approved reads and denies hard-floor discovery, invocation and revoked reads", async t => {
  const { control, write } = await fixture(t);
  const server = createMcp(control, "operator", true, { grants: {} });
  const [peer, local] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "model-policy-test", version: "1" });
  await server.connect(local);
  await client.connect(peer);
  t.after(async () => { await client.close(); await server.close(); });
  const { tools } = await client.listTools();
  assert.ok(tools.some(tool => tool.name === "get_status"));
  assert.ok(tools.every(tool => tool.annotations?.readOnlyHint === true));
  for (const name of [...deny, ...hardFloor, "pause_entries", "queue_controls_pause"]) {
    assert.ok(!tools.some(tool => tool.name === name), name);
    assert.equal((await client.callTool({ name })).isError, true, name);
  }
  const result = await client.callTool({ name: "get_status" });
  assert.deepEqual(result.structuredContent, await control.status());
  await write({ get_status: "deny" });
  assert.equal((await client.callTool({ name: "get_status" })).isError, true);
});

test("evaluation records, scores and replays approval without dispatching missing MFA, replayed grants or denied tools", async t => {
  const { directory } = await fixture(t);
  const tool = "queue_controls_pause";
  const args = { request_id: "approval-fixture" };
  const approval = { tool, digest: fixtureDigest(args), recentMfa: true, id: "single-use" };
  const steps: FixtureStep[] = [
    { kind: "model", model: "fixture" },
    { kind: "tool", tool: "get_status", args: {} },
    { kind: "tool", tool, args, approval: { ...approval, recentMfa: false } },
    { kind: "tool", tool, args: { request_id: "substitution" }, approval },
    { kind: "tool", tool, args, approval },
    { kind: "tool", tool, args, approval },
    { kind: "tool", tool: "read_key_source", args: { secret: "must-not-record" } },
  ];
  const grants = { [tool]: "ask" } as const;
  const result = evaluateFixture(steps, grants);
  assert.deepEqual(result.slice(1).map(event => event.decision), ["ALLOW", "ASK", "ASK", "APPROVED", "ASK", "DENY"]);
  assert.deepEqual(scoreFixture(result, [{ name: "get_status", requestId: "read-id" },
    { name: tool, requestId: "write-id" }]), { toolCalls: 6, approvalPrompts: 4, matched: true });
  assert.equal(scoreFixture(result, [{ name: tool, requestId: "write-id" }]).matched, false);
  await recordFixture(directory, "run-1", result);
  assert.ok(!(await readFile(join(directory, "run-1.jsonl"), "utf8")).includes("must-not-record"));
  assert.equal(await replayFixture(directory, "run-1", steps, grants), true);
  assert.equal(await replayFixture(directory, "run-1", steps, {}), false);
});
