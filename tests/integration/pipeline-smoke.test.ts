import { strict as assert } from "node:assert";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Keypair, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { bytesToHex, recoverTransactionAddress } from "viem";
import type { TransactionSerializedLegacy } from "viem";
import type { Handoff } from "../../schemas/common.js";
import type { ScannerInput } from "../../schemas/scanner.js";
import { scanner } from "../../src/agents/scanner.js";
import { responsesAgent } from "../../src/agents/call.js";
import type { CallAgent } from "../../src/agents/call.js";
import { signApprovedTransaction } from "../../src/agents/executor.js";
import { merge } from "../../src/cache/merge.js";
import { fileAudit, replayPositions } from "../../src/logging/logger.js";
import type { AuditEvent } from "../../src/logging/types.js";
import { CandidateError, SystemError } from "../../src/orchestrator/errors.js";
import { runLoop } from "../../src/orchestrator/loop.js";
import { runCandidate } from "../../src/orchestrator/pipeline.js";
import { Equity } from "../../src/state/equity.js";
import { Positions } from "../../src/state/positions.js";

const identity: Handoff = {
  run_id: "smoke", chain: "base",
  token: "0x1111111111111111111111111111111111111111",
  pair: "0x2222222222222222222222222222222222222222",
};
const checks = { renounced: true, mint_auth: true, freeze_auth: true, lp_locked_or_burned: true,
  honeypot: true, tax_ok: true, blacklist: false, deployer_ok: true, age_ok: true, holder_conc_ok: true };
const raw = { renounced: true, mint_auth_disabled: true, freeze_auth_disabled: true,
  lp_locked_or_burned: true, honeypot_sim_ok: true };
const feedRow = { chain: identity.chain, token: identity.token, pair: identity.pair,
  liquidity_usd: 100_000, vol_1h_usd: 20_000, age_sec: 900, trigger: "new_pair" as const };
const scanRow = { ...identity, ...feedRow, discovered_at: 1_795_200_000, rank_score: 1, reason: "fixture", skipped: false };
const fakeAgent: CallAgent = async ({ schema, prompt, identity: handoff, data }) => {
  const output = {
    scanner: () => [{ ...scanRow, ...(data as ScannerInput).feed[0], ...handoff }],
    "rug-check": () => ({ ...handoff, verdict: "PASS", checks, reason: "fixture" }),
    sizer: () => ({ ...handoff, status: "SIZED", size_usd: 50, size_tokens: 25, max_slippage_bps: 150,
      equity_at_decision: 1000, equity_age_sec: 0, risk_pct_used: .02, reason: "fixture" }),
    executor: () => ({ ...handoff, action: "entry", status: "FILLED", fill_price: 2, size_usd: 10,
      gas_usd: 0, slippage_bps: 0, tx_hash: "sim", reason: "fixture" }),
    logger: () => {
      const hops = data as Array<{ hop: { agent: string; output: unknown } }>;
      return { logged: hops.length, rows: hops.map(({ hop }) => ({
        run_id: handoff.run_id, token: handoff.token, as_of: 1_795_200_000, gaps: [], ...hop,
      })) };
    },
    "equity-curve": () => ({ equity_usd: 1000, drawdown_pct: 0, win_rate: 0, expectancy_usd: 0,
      trades_closed: 0, as_of: (data as { as_of: number }).as_of }),
  };
  return schema.parse(output[prompt as keyof typeof output]());
};

function snapshot(assessment: "clear" | "unknown" = "clear") {
  const now = Date.now();
  return merge(identity, { observedAt: now, value: { price_usd: 2, liquidity_usd: 100_000, summary: "", vol_1h_usd: 20_000, created_at_ms: now - 900_000 } },
    { observedAt: now, value: { assessment, reasons: [], checks_raw: raw } }, undefined, { marketMs: 30_000, securityMs: 30_000 });
}

test("runs the six stages, caps size, and replays the one paper fill from the audit", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "trade-bot-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const path = join(directory, "audit.jsonl");
  const positions = new Positions();
  const deps = { call: fakeAgent, audit: fileAudit(path), positions, equity: new Equity(100_000),
    maxPositionBps: 100, maxOpenPositions: 2 };
  assert.equal(await runCandidate(snapshot(), deps), "paper_fill");
  assert.equal(await runCandidate(snapshot(), deps), "skipped");
  assert.equal(positions.committedCents, 1000);
  assert.deepEqual(await replayPositions(path), [{ ...identity, cost_cents: 1000, entry_price_usd: 2 }]);
  const events = (await readFile(path, "utf8")).trim().split("\n").map((line) => JSON.parse(line) as AuditEvent);
  assert.deepEqual(events.slice(0, 7).map(({ stage }) => stage),
    ["scanner", "rug-check", "sizer", "executor", "executor", "equity-curve", "logger"]);
  assert.deepEqual(events[6]?.gaps, ["social_unavailable"]);
});

test("blocks unknown security and snapshots that expire while Executor runs", async () => {
  const positions = new Positions();
  const deps = { audit: async () => {}, positions, equity: new Equity(100_000),
    maxPositionBps: 100, maxOpenPositions: 2 };
  assert.equal(await runCandidate(snapshot("unknown"), { ...deps, call: fakeAgent }), "skipped");
  const expiring = snapshot();
  let now = Date.now();
  const call: CallAgent = async (request) => {
    if (request.prompt === "executor") now += 30_000;
    return fakeAgent(request);
  };
  assert.equal(await runCandidate(expiring, { ...deps, call, now: () => now }), "skipped");
  assert.equal(positions.count, 0);
});

test("opens the circuit breaker after repeated mandatory system errors", async () => {
  const abort = new AbortController();
  const events: AuditEvent[] = [];
  await runLoop({ targets: [identity], ttl: { marketMs: 50, securityMs: 50 },
    intervalMs: 1, breakerFailures: 2, breakerCooldownMs: 50, socialEnabled: false },
  {
    maxPositionBps: 100, maxOpenPositions: 2, equity: new Equity(100_000), positions: new Positions(),
    call: async () => { throw new SystemError("simulated"); },
    audit: async (event) => { events.push(event); if (event.stage === "breaker") abort.abort(); },
  }, abort.signal);
  assert.deepEqual(events.map(({ stage }) => stage), ["pipeline", "pipeline", "breaker"]);
});

test("submits the prompt verbatim, round-trips tool evidence and rejects invalid structured output", async (t) => {
  const requests: Record<string, unknown>[] = [];
  let valid = true;
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    const request = JSON.parse(String(init.body)) as Record<string, unknown>;
    requests.push(request);
    const output = requests.length === 1
      ? [{ type: "function_call", name: "lookup", call_id: "call_1", arguments: "{}" }]
      : [{ type: "message", role: "assistant", content: [{ type: "output_text",
        text: JSON.stringify({ rows: [{ ...scanRow, rank_score: valid ? 1 : "invalid" }] }) }] }];
    return Response.json({ status: "completed", output });
  });
  const call = responsesAgent("test-key", "test-model");
  const data: ScannerInput = { run_id: identity.run_id, feed: [feedRow], seen: [], now: scanRow.discovered_at,
    config: { min_liquidity_usd: 1000, min_age_sec: 600, min_vol_1h_usd: 1000, top_n: 20, dedup_window_sec: 3600 } };
  let toolCalls = 0;
  const toolCall: CallAgent = request => call({ ...request, tools: [{ name: "lookup", description: "Fixture", run: async () => ++toolCalls }] });
  const output = await scanner(toolCall, identity, data);
  assert.equal(output[0]?.skipped, false);
  assert.equal(toolCalls, 1);
  const prompt = await readFile(new URL("../../prompts/scanner.md", import.meta.url), "utf8");
  assert.ok(requests.every((item) => item.instructions === prompt));
  assert.deepEqual((requests[1]?.input as unknown[]).at(-1), { type: "function_call_output", call_id: "call_1", output: "1" });
  valid = false;
  await assert.rejects(scanner(call, identity, data), CandidateError);
});

test("signs prebuilt EVM and Solana transactions in code without broadcasting", async () => {
  const approval = { ...identity, decision: "approve" as const, reason: "fixture" };
  const expires = Date.now() + 30_000;
  const privateKey = generatePrivateKey();
  const evm = await signApprovedTransaction(approval, expires, { chain: "evm", privateKey,
    transaction: { type: "legacy", chainId: 8453, nonce: 0, gas: 21_000n, gasPrice: 1n, value: 1n, to: identity.token as `0x${string}` } });
  assert.equal(await recoverTransactionAddress({ serializedTransaction: bytesToHex(evm) as TransactionSerializedLegacy }),
    privateKeyToAccount(privateKey).address);
  const payer = Keypair.generate();
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash: "11111111111111111111111111111111",
    instructions: [SystemProgram.transfer({ fromPubkey: payer.publicKey, toPubkey: Keypair.generate().publicKey, lamports: 1 })],
  }).compileToV0Message();
  const request = { chain: "solana" as const, secretKey: payer.secretKey, transaction: new VersionedTransaction(message) };
  const bytes = await signApprovedTransaction({ ...approval, chain: "solana" }, expires, request);
  assert.ok(VersionedTransaction.deserialize(bytes).signatures[0]?.some((byte) => byte !== 0));
  await assert.rejects(signApprovedTransaction({ ...approval, chain: "solana" }, Date.now() - 1, request), CandidateError);
});
