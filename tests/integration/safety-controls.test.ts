import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test, type TestContext } from "node:test";
import { defaultRisk } from "../../schemas/risk-config.js";
import { createDashboardApi } from "../../src/dashboard-api/routes.js";
import { SafetyGate } from "../../src/control/safety.js";
import { Equity } from "../../src/state/equity.js";
import { Positions } from "../../src/state/positions.js";
import { createLiveExecution } from "../../src/wallet/live.js";
import { createSigner, type ChainAdapter } from "../../src/wallet/signer.js";
import { caps, intent, noWait, walletFixture } from "../wallet-fixture.js";

async function fixture(t: TestContext, beforePrepare?: () => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), "dex-safety-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const apiLogPath = join(root, "api-log.jsonl");
  const inboxPath = join(root, "controls");
  const gate = new SafetyGate(inboxPath);
  let reads = 0;
  const app = createDashboardApi({ token: "fixture", auditPath: join(root, "audit.jsonl"), apiLogPath,
    riskPath: join(root, "risk.jsonl"), inboxPath, initialCents: 1, events: async () => {
      reads++;
      throw new Error("status storage offline");
    } });
  const fetch = (path: string, body?: object) => app.request(path, {
    headers: { Authorization: "Bearer fixture", "Content-Type": "application/json" },
    ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }),
  });
  const post = (action: string, body = {}) => fetch("/api/v1/controls/" + action, body);
  const { journal, audit } = walletFixture();
  const trace: string[] = [];
  const adapter: ChainAdapter = {
    chain: "base", address: async () => "wallet",
    async prepare() {
      trace.push("simulate");
      await beforePrepare?.();
      return { simulation: { ok: true, max_fee_native: "1" },
        sign: async () => { trace.push("sign"); return { id: "confirmed-id", bytes: Uint8Array.of(1) }; } };
    },
    async broadcast() { trace.push("broadcast"); return "confirmed-id"; },
    async receipt(tx, { id }) { trace.push("confirm"); return {
      chain: "base", status: "confirmed", tx_hash: id, amount_in: tx.amount_in, amount_out: tx.min_amount_out,
    }; },
  };
  const signer = createSigner(adapter, caps, audit, journal, noWait, () => true, () => gate.state());
  return { root, trace, audit, signer, journal, gate, fetch, post, apiLogPath, reads: () => reads };
}

test("emergency stop works with broken status and records the durable API receipt", async t => {
  const f = await fixture(t);
  assert.equal((await f.fetch("/api/v1/status")).status, 503);
  const response = await f.post("emergency-stop", { request_id: "emergency-1" });
  assert.equal(response.status, 202);
  const receipt = await response.json();
  assert.equal(receipt.state, "reduce_only");
  assert.equal(receipt.request_id, "emergency-1");
  assert.equal(f.reads(), 1, "command must not read the unavailable journal");
  const retry = await f.post("emergency-stop", { request_id: "emergency-1" });
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).request_id, receipt.request_id);
  const rows = (await readFile(f.apiLogPath, "utf8")).trim().split("\n").map(line => JSON.parse(line));
  assert.deepEqual(rows.map(row => [row.surface, row.path, row.status, row.request_id]), [
    ["rest", "/api/v1/controls/emergency-stop", 202, receipt.request_id],
    ["rest", "/api/v1/controls/emergency-stop", 200, receipt.request_id],
  ]);
  assert.equal(new SafetyGate(join(f.root, "controls")).state(), "reduce_only");
});

test("entry after emergency stop has no signature, tx_hash or broadcast", async t => {
  const f = await fixture(t);
  assert.equal((await f.post("emergency-stop")).status, 202);
  await assert.rejects(f.signer.signAndSend(intent), { message: "REDUCE_ONLY_VIOLATION" });
  assert.deepEqual(f.trace, []);
  assert.deepEqual(f.journal, []);
});

test("a protective exit after emergency stop simulates, signs, broadcasts and journals the confirmed exit", async t => {
  const f = await fixture(t);
  assert.equal((await f.post("emergency-stop")).status, 202);
  const positions = new Positions();
  const equity = new Equity(10000);
  const position = { run_id: "already-open", chain: "base" as const, token: "token", pair: "pair", cost_cents: 100,
    entry_price_usd: 1, live_amount: "100", exit_policy: { entry_at: Date.now(), entry_price: 1, max_hold_sec: 3600,
      min_profit_bps_for_exit: 25, mode: "profit_only" as const, timeout_ladder: defaultRisk.timeout_ladder } };
  positions.record(position);
  const live = createLiveExecution({ enabled: () => false, exitAllowed: () => true, config: caps, signer: f.signer,
    audit: f.audit, journal: f.journal, positions, equity, stable: "stable", stableDecimals: 6, usdPerUnit: 1,
    decimals: new Map([["token", 2]]) });
  assert.equal(await live.exit(position, 1, 0, "stop"), true);
  assert.deepEqual(f.trace, ["simulate", "sign", "broadcast", "confirm"]);
  assert.equal(f.journal.find(row => row.status === "live_close")?.close?.exit_reason, "stop");
  assert.equal((f.journal.find(row => row.status === "live_close")?.detail as { tx_hash: string }).tx_hash, "confirmed-id");
  assert.equal(positions.count, 0);
});

test("mid-flight emergency stop rejects an entry before signing and broadcasting", async t => {
  let enter!: () => void;
  let finish!: () => void;
  const entered = new Promise<void>(resolve => { enter = resolve; });
  const release = new Promise<void>(resolve => { finish = resolve; });
  const f = await fixture(t, async () => { enter(); await release; });
  const pending = f.signer.signAndSend(intent);
  await entered;
  try { assert.equal((await f.post("emergency-stop")).status, 202); }
  finally { finish(); }
  await assert.rejects(pending, { message: "REDUCE_ONLY_VIOLATION" });
  assert.deepEqual(f.trace, ["simulate"]);
  assert.ok(!JSON.stringify(f.journal).includes("confirmed-id"));
});

test("flatten requests exits under reduce-only, while typed signer disarm rejects exits too", async t => {
  const f = await fixture(t);
  const flatten = await f.post("flatten");
  assert.equal(flatten.status, 202);
  assert.equal((await flatten.json()).details.flatten_requested, true);
  assert.equal(f.gate.state(), "reduce_only");
  assert.equal(f.gate.flattenRequested(), true);
  assert.equal((await f.post("disarm-signer", { confirmation: "KILL" })).status, 400);
  assert.equal((await f.post("disarm-signer", { confirmation: "DISARM" })).status, 202);
  assert.equal(f.gate.state(), "disarmed");
  assert.equal(f.gate.flattenRequested(), false);
  await assert.rejects(f.signer.signAndSend({ ...intent, reduce_only: true }), { message: "SIGNER_DISARMED" });
  assert.deepEqual(f.trace, []);
});

test("deployment pause during the durable signed write prevents broadcast",async()=>{
  const {journal,audit}=walletFixture();
  let deploymentOpen=true, broadcasts=0;
  const adapter:ChainAdapter={
    chain:"base",address:async()=>"wallet",
    prepare:async()=>({simulation:{ok:true,max_fee_native:"1"},
      sign:async()=>({id:"prepared-id",bytes:Uint8Array.of(1)})}),
    async broadcast(){broadcasts++; return "prepared-id";},
    receipt:async()=>({chain:"base",status:"pending",tx_hash:"prepared-id"}),
  };
  const signer=createSigner(adapter,caps,async event=>{
    await audit(event);
    if ((event.detail as {event?:string} | undefined)?.event==="signed") deploymentOpen=false;
  },journal,noWait);
  await assert.rejects(signer.signAndSend(intent,()=>deploymentOpen),/DEPLOYMENT_PAUSED/);
  assert.equal(broadcasts,0);
  assert.equal(await createSigner(adapter,caps,audit,journal,noWait).reconcile(intent),null);
});
