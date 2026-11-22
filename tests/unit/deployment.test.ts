import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { deploymentGate } from "../../src/orchestrator/deployment.js";

test("deployment marker gates new entries and acknowledges only a valid request", async t => {
  const dir = await mkdtemp(join(tmpdir(), "deploy-gate-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const gate = deploymentGate(join(dir, "audit.jsonl"));
  const marker = join(dir, ".deploying");
  assert.equal(gate.paused(), false);
  await writeFile(marker, "invalid");
  assert.equal(gate.paused(), true);
  await gate.acknowledge();
  await assert.rejects(readFile(marker + ".ack"), { code: "ENOENT" });
  const nonce = "a".repeat(32);
  await writeFile(marker, nonce + "\n");
  await gate.acknowledge();
  assert.equal(await readFile(marker + ".ack", "utf8"), nonce + "\n");
  await unlink(marker);
  assert.equal(gate.paused(), false);
});
