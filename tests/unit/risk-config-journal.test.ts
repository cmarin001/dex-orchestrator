import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { defaultRisk } from "../../schemas/risk-config.js";
import { riskBudget } from "../../src/agents/sizer.js";
import { appendRisk, readRisk, requireFreshRisk } from "../../src/state/risk-config.js";

test("appends risk revisions and rejects a stale or future revision", async t => {
  const dir = await mkdtemp(join(tmpdir(), "risk-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const path = join(dir, "risk.jsonl");
  await appendRisk(path, { actor: "operator", as_of: 100, config: defaultRisk });
  const first = await readFile(path, "utf8");
  const edited = { ...defaultRisk, halt_new_entries_dd: 0.2 };
  await appendRisk(path, { actor: "operator", as_of: 200, config: edited });
  assert.ok((await readFile(path, "utf8")).startsWith(first));
  const latest = await readRisk(path);
  assert.deepEqual(requireFreshRisk(latest, 250, 100), edited);
  assert.throws(() => requireFreshRisk(latest, 300, 100), /stale/);
  assert.throws(() => requireFreshRisk(latest, 199, 100), /stale/);
  assert.throws(() => riskBudget(edited, 0.2, 10_000, 1000), /drawdown/);
});
