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
import { scannerSchema } from "../../schemas/scanner.js";
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
const outputs = {
  scanner: { decision: "advance", reason: "fixture" },
  "rug-check": { assessment: "clear", reasons: [] },
  sizer: { requested_cents: 5000, reason: "fixture" },
  executor: { decision: "approve", reason: "fixture" },
  logger: { summary: "Paper fill", gaps: [] },
  "equity-curve": { commentary: "No realized return" },
};
const fakeAgent: CallAgent = async ({ schema, prompt, identity: handoff }) =>
  schema.parse({ ...handoff, ...outputs[prompt as keyof typeof outputs] });

function snapshot(assessment: "clear" | "unknown" = "clear") {
  const now = Date.now();
  return merge(identity, { observedAt: now, value: { price_usd: 2, liquidity_usd: 100_000, summary: "" } },
    { observedAt: now, value: { assessment, reasons: [] } }, undefined, { marketMs: 30_000, securityMs: 30_000 });
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
    ["scanner", "rug-check", "sizer", "executor", "executor", "logger", "equity-curve"]);
  assert.deepEqual(events[5]?.gaps, ["social_unavailable"]);
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
        text: JSON.stringify({ ...identity, decision: valid ? "advance" : "override", reason: "fixture" }) }] }];
    return Response.json({ status: "completed", output });
  });
  const call = responsesAgent("test-key", "test-model");
  const request = { identity, prompt: "scanner", schema: scannerSchema, data: {} };
  let toolCalls = 0;
  const output = await call({ ...request, tools: [{ name: "lookup", description: "Fixture", run: async () => ++toolCalls }] });
  assert.equal(output.decision, "advance");
  assert.equal(toolCalls, 1);
  const prompt = await readFile(new URL("../../prompts/scanner.md", import.meta.url), "utf8");
  assert.ok(requests.every((item) => item.instructions === prompt));
  assert.deepEqual((requests[1]?.input as unknown[]).at(-1), { type: "function_call_output", call_id: "call_1", output: "1" });
  valid = false;
  await assert.rejects(call(request), CandidateError);
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
