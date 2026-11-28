import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { tradeKey } from "../../schemas/common.js";
import { fileAudit, readJournal } from "../../src/logging/logger.js";
import { id } from "../agent-fixture.js";

test("paper worker restores open positions and removes closed positions before publishing readiness", async t => {
  const directory = await mkdtemp(join(tmpdir(), "dex-worker-restore-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const auditPath = join(directory, "audit.jsonl");
  const audit = fileAudit(auditPath);
  const closed = { ...id, cost_cents: 100, entry_price_usd: 2 };
  const open = { ...closed, run_id: "restored-open", pair: "0x" + "d".repeat(40) };

  await audit({ stage: "executor", status: "paper_fill", position: closed, gaps: [] });
  await audit({ stage: "executor", status: "paper_fill", position: open, gaps: [] });
  await audit({ stage: "executor", status: "paper_close", position: closed, gaps: [],
    close: { exit_at: Date.now(), exit_price: 2, exit_reason: "manual", proceeds_cents: 100 } });

  const worker = spawn(process.execPath, [
    "--import", "tsx", "--import", "./tests/phase3-market-preload.ts", "src/index.ts",
  ], {
    env: {
      EXECUTION_MODE: "paper", OPERATING_MODE: "strategies", LOG_LEVEL: "silent",
      AUDIT_PATH: auditPath, RISK_CONFIG_PATH: join(directory, "risk.jsonl"),
      CONTROL_INBOX_PATH: join(directory, "inbox"), WATCHLIST: JSON.stringify([{ chain: id.chain, token: id.token, pair: id.pair }]),
      LOOP_INTERVAL_MS: "60000",
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  const shutdown = once(worker, "close");
  let stderr = "";
  worker.stderr.on("data", chunk => { stderr += String(chunk); });
  try {
    const deadline = Date.now() + 6000;
    while (Date.now() < deadline && worker.exitCode === null && worker.signalCode === null) {
      const events = await readJournal(auditPath, true);
      const replay = events.findIndex(event => event.stage === "worker_replay");
      const running = events.findIndex(event => event.stage === "worker_lifecycle" && event.detail === "running");
      if (running >= 0) {
        assert.ok(replay >= 0 && replay < running);
        assert.deepEqual(events[replay]!.detail, { position_keys: [tradeKey(open)] });
        return;
      }
      await sleep(30);
    }
    assert.fail("Worker did not publish replay and readiness. " + stderr);
  } finally {
    if (worker.exitCode === null && worker.signalCode === null) worker.kill();
    await shutdown;
  }
});
