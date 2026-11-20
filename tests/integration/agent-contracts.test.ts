import assert from "node:assert/strict";
import { test } from "node:test";
import { responsesAgent } from "../../src/agents/call.js";
import { equityCurve } from "../../src/agents/equity-curve.js";
import { executor } from "../../src/agents/executor.js";
import { logger } from "../../src/agents/logger.js";
import { requireRugCheckPass, rugCheck } from "../../src/agents/rug-check.js";
import { scanner } from "../../src/agents/scanner.js";
import { sizer } from "../../src/agents/sizer.js";

test("six agent wrappers accept the specialized prompt contracts through the Responses wire format", async t => {
  const now = 1_795_200_000;
  const identity = { run_id: "smoke", token: "token-a", pair: "pool-a", chain: "solana" } as const;
  const candidate = { ...identity, trigger: "new_pair", liquidity_usd: 50_000, vol_1h_usd: 20_000, age_sec: 900,
    discovered_at: now, rank_score: 1, reason: "new_pair", skipped: false } as const;
  const rows = [candidate,
    { ...candidate, token: "seen", pair: "pool-b", rank_score: 0, reason: "dedup", skipped: true },
    { ...candidate, token: "thin", pair: "pool-c", liquidity_usd: 5000, rank_score: 0, reason: "below_min_liquidity", skipped: true },
  ];
  const raw = { renounced: true, mint_auth_disabled: false, freeze_auth_disabled: true, lp_locked_or_burned: true, honeypot_sim_ok: true };
  const rug = { ...identity, verdict: "FAIL", checks: { renounced: true, mint_auth: false, freeze_auth: true,
    lp_locked_or_burned: true, honeypot: true, tax_ok: true, blacklist: false,
    deployer_ok: true, age_ok: true, holder_conc_ok: true }, reason: "mint_auth_disabled" } as const;
  const sizing = { ...identity, status: "SIZED", size_usd: 15, size_tokens: 7.5, max_slippage_bps: 150,
    equity_at_decision: 1000, equity_age_sec: 10, risk_pct_used: .02,
    reason: "1000 × 2% = 20; 20 × 20/25 = 16; min(16, 50000 × 1.5%) − 1 = 15" } as const;
  const execution = { ...identity, action: "entry", status: "ABORTED", fill_price: null, size_usd: null,
    gas_usd: null, slippage_bps: 200, tx_hash: "sim", reason: "slippage_above_max" } as const;
  const equity = { equity_usd: 1006, drawdown_pct: 4 / 1010, win_rate: .5, expectancy_usd: 3, trades_closed: 2, as_of: now };
  const hops = [{ agent: "scanner", output: candidate }, { agent: "rug", output: rug }, { agent: "sizer", output: sizing },
    { agent: "executor", output: execution }, { agent: "equity", output: equity }] as const;
  const trace = { logged: hops.length, rows: hops.map(hop => ({ ...hop, run_id: identity.run_id, token: identity.token, as_of: now, gaps: [] })) };
  const wire: Record<string, unknown> = { scanner: { rows }, "rug-check": rug, sizer: sizing, executor: execution, logger: trace, "equity-curve": equity };
  const inputs = new Map<string, unknown>();
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const name = body.text.format.name as keyof typeof wire;
    inputs.set(name, JSON.parse(body.input[0].content));
    assert.equal(body.text.format.schema.type, "object");
    return Response.json({ status: "completed", output: [{ type: "message", role: "assistant",
      content: [{ type: "output_text", text: JSON.stringify(wire[name]) }] }] });
  });
  const call = responsesAgent("fixture", "fixture");
  const scan = await scanner(call, identity, {
    run_id: identity.run_id, seen: ["seen"], now,
    feed: rows.map(({ chain, token, pair, trigger, liquidity_usd, vol_1h_usd, age_sec }) =>
      ({ chain, token, pair, trigger, liquidity_usd, vol_1h_usd, age_sec })),
    config: { min_liquidity_usd: 10_000, min_age_sec: 600, min_vol_1h_usd: 5000, top_n: 20, dedup_window_sec: 3600 },
  });
  assert.equal(scan.filter(row => row.skipped).length, 2);
  assert.deepEqual(await rugCheck(call, identity, { ...candidate, checks_raw: raw }), rug);
  assert.throws(() => requireRugCheckPass("clear", { ...rug, verdict: "PASS" }, raw, 900), /risk_not_clear/);
  assert.equal((await sizer(call, identity, { rug: { verdict: "PASS" }, now,
    equity: { equity_usd: 1000, drawdown_pct: .05, as_of: now - 10 },
    market: { liquidity_usd: 50_000, volatility_pct: 25, gas_usd: 1, reference_price: 2 },
    config: { max_risk_pct_per_trade: .02, max_position_vs_pool_depth: .015, max_slippage_bps: 150,
      halt_new_entries_dd: .15, max_equity_age_sec: 60 },
  })).size_usd, 15);
  assert.equal((await executor(call, identity, { sizer: sizing, action: "entry", position: null,
    market: { quote_price: 2, expected_slippage_bps: 200, gas_usd: 1, now },
  })).status, "ABORTED");
  assert.deepEqual(await logger(call, identity, hops), trace);
  assert.deepEqual(await equityCurve(call, identity, { starting_equity_usd: 1000, as_of: now,
    closed_trades: [10, -4].map((pnl_usd, index) => ({ run_id: "closed-" + index, token: identity.token,
      pnl_usd, slippage_bps: 0, hold_sec: 60, closed_at: now - 60 + index })),
  }), equity);
  assert.equal(inputs.size, 6);
  assert.ok(Array.isArray(inputs.get("logger")));

  wire.executor = { ...execution, status: "FILLED", fill_price: 2, size_usd: 15, gas_usd: 1 };
  await assert.rejects(executor(call, identity, { sizer: sizing, action: "entry", position: null,
    market: { quote_price: 2, expected_slippage_bps: 200, gas_usd: 1, now },
  }), /Output does not match request/);
});
