import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const { HERMES_TEST_PROFILE: profile, HERMES_TEST_API_LOG: logPath, HERMES_CLI: command = "hermes" } = process.env;
assert(profile && logPath, "Set HERMES_TEST_PROFILE and HERMES_TEST_API_LOG for an isolated test profile");

const client = new Client({ name: "tradekeel-hermes-gate", version: "1" });
const transport = new StdioClientTransport({ command, args: ["-p", profile, "mcp-serve", "--tools"], stderr: "pipe" });
try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  assert(tools.some(tool => tool.name === "get_status"),
    "HERMES_NATIVE_FORWARDING_UNAVAILABLE: use curated operator fallback C");
  const before = await readFile(logPath, "utf8");
  const status = await client.callTool({ name: "get_status" });
  assert.equal(status.isError ?? false, false);
  assert.equal(typeof status.structuredContent?.loop_state, "string");
  const after = await readFile(logPath, "utf8");
  assert(after.startsWith(before), "Acceptance test needs an isolated append-only API log");
  const rows = after.slice(before.length).split("\n").filter(Boolean).map(line => JSON.parse(line));
  const expected = [["mcp", "hermes:model", "/mcp"], ["mcp", "mcp:hermes", "/mcp"],
    ["rest", "mcp:hermes", "/api/v1/status"]] as const;
  const first = rows.find(row => row.surface === "mcp" && row.actor === "hermes:model" && row.path === "/mcp");
  assert.equal(typeof first?.request_id, "string");
  const related = rows.filter(row => row.request_id === first.request_id);
  assert.deepEqual(related.map(row => [row.surface, row.actor, row.path]), expected.map(row => [...row]));
  console.log("Verified the real Hermes invocation and three correlated API log rows.");
} finally {
  await client.close();
}
