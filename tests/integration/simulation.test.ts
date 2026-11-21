import { securityProvider, geckoResponse } from "../agent-fixture.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import { reconA } from "../../src/agents/recon-a.js";
import { reconB } from "../../src/agents/recon-b.js";
import { toRugChecks } from "../../schemas/recon-checks.js";
import { merge } from "../../src/cache/merge.js";
import { runCandidate } from "../../src/orchestrator/pipeline.js";
import { Equity } from "../../src/state/equity.js";
import { Positions } from "../../src/state/positions.js";
import type { AuditEvent } from "../../src/logging/types.js";
import type { LogHop } from "../../schemas/logger.js";
import { id, now, market, security, scan, rug, sizing, fill, portfolio, mockApi } from "../agent-fixture.js";

test("discovery to paper entry, audit and equity publication through the real wrappers", async (t) => {
  const events: AuditEvent[] = [];
  const { call, names } = mockApi(t, (name, data) => {
    switch (name) {
      case "recon-a-market-intel":
        return { rows: [market] };
      case "recon-b-onchain":
        return security;
      case "scanner":
        return { rows: [scan] };
      case "rug-check":
        assert.deepEqual(data, { ...scan, checks_raw: toRugChecks(security.checks_raw) });
        return rug;
      case "sizer":
        assert.deepEqual((data as { rug: unknown }).rug, { verdict: "PASS" });
        return sizing;
      case "executor":
        assert.equal((data as { sizer: { size_usd: number } }).sizer.size_usd, 10);
        return fill;
      case "equity-curve":
        return portfolio;
      case "logger": {
        const hops = data as Array<{ hop: LogHop }>;
        return {
          logged: hops.length,
          rows: hops.map(({ hop }) => ({ ...hop, run_id: id.run_id, token: id.token, as_of: now, gaps: [] })),
        };
      }
      default:
        throw new Error(name);
    }
  });
  const rows = await reconA(
    call,
    id,
    {
      run_id: id.run_id,
      chain: id.chain,
      modes: ["new_pairs"],
      seen: [],
      config: {
        min_liquidity_usd: 15000,
        min_vol_1h_usd: 10000,
        min_age_sec: 600,
        max_age_sec: 86400,
      },
    },
    async () => Response.json(geckoResponse),
  );
  const [row] = rows;
  assert.ok(row && !("status" in row));
  const risk = await reconB(call, id, row.age_sec, securityProvider);
  const at = now * 1000;
  const fact = (value: number) => ({ value, source: row.source, fetched_at: at });
  const checks_raw = toRugChecks(risk.checks_raw);
  const observation = merge(id, {
    target: { chain: id.chain, token: id.token, pair: id.pair },
    market: {
      source_fetched_at: at,
      trigger: row.trigger,
      liquidity_usd: fact(row.liquidity_usd),
      vol_1h_usd: fact(row.vol_1h_usd),
      age_sec: fact(row.age_sec),
      price_usd: fact(2),
    },
    security: {
      checks_raw,
      assessment: "clear",
      sources_disagree: risk.sources_disagree,
      source_fetched_at: at,
      provenance: Object.fromEntries(
        Object.keys(checks_raw).map((k) => [k, { source: "fixture", ok: true, fetched_at: at }]),
      ),
    },
  });
  const positions = new Positions(),
    equity = new Equity(100000);
  assert.equal(
    await runCandidate(observation, {
      call,
      audit: async (e) => {
        events.push(e);
      },
      positions,
      equity,
      maxPositionBps: 100,
      maxOpenPositions: 1,
    }),
    "paper_fill",
  );
  const replay: AuditEvent[] = [];
  assert.equal(
    await runCandidate(observation, {
      call,
      audit: async (event) => {
        replay.push(event);
      },
      positions: new Positions(),
      equity: new Equity(100000),
      maxPositionBps: 100,
      maxOpenPositions: 1,
    }),
    "paper_fill",
  );
  assert.deepEqual(replay, events);
  assert.equal(positions.count, 1);
  assert.equal(positions.committedCents, 1000);
  assert.equal(equity.availableCapital - positions.committedCents, 99000);
  const journal = events.find((e) => e.stage === "logger")?.detail as { logged: number; rows: LogHop[] };
  assert.equal(journal.logged, 5);
  assert.deepEqual(
    journal.rows.map((r) => r.output),
    [scan, rug, sizing, fill, portfolio],
  );
  assert.deepEqual(events.at(-1)?.detail, portfolio);
  assert.deepEqual(names.slice(0, 9), [
    "recon-a-market-intel",
    "recon-b-onchain",
    "scanner",
    "rug-check",
    "equity-curve",
    "sizer",
    "executor",
    "logger",
    "equity-curve",
  ]);
});

for (const scenario of ["missing_mint", "skipped", "stale_equity", "drawdown", "slippage"] as const) {
  test("pipeline stops at the declared gate for " + scenario, async (t) => {
    let clock = now * 1000;
    const { call, names } = mockApi(t, (name, data) => {
      if (name === "scanner")
        return {
          rows: [
            scenario === "skipped"
              ? { ...scan, liquidity_usd: 100, rank_score: 0, skipped: true, reason: "below_min_liquidity" }
              : scan,
          ],
        };
      if (name === "rug-check")
        return scenario === "missing_mint"
          ? {
              ...rug,
              verdict: "FAIL",
              checks: { ...rug.checks, mint_auth: false },
              reason: "ambiguous critical: mint_auth",
            }
          : rug;
      if (name === "equity-curve")
        return scenario === "drawdown"
          ? { ...portfolio, equity_usd: 800, drawdown_pct: 0.2, trades_closed: 1, expectancy_usd: -200 }
          : portfolio;
      if (name === "sizer") {
        if (scenario === "drawdown")
          return {
            ...sizing,
            status: "HALTED",
            size_usd: 0,
            size_tokens: null,
            equity_at_decision: 800,
            reason: "drawdown_circuit_breaker",
          };
        if (scenario === "stale_equity")
          return {
            ...sizing,
            status: "REFUSED",
            size_usd: 0,
            size_tokens: null,
            equity_age_sec: 61,
            reason: "stale_equity",
          };
        return sizing;
      }
      if (name === "executor") {
        assert.equal((data as { market: { expected_slippage_bps: number } }).market.expected_slippage_bps, 200);
        return { ...fill, status: "ABORTED", fill_price: null, reason: "slippage_above_max" };
      }
      throw new Error("Unexpected stage " + name);
    });
    const qty = (value: number) => ({ source: "fixture", fetched_at: now * 1000, value });
    const snapshot = merge(id, {
      target: id,
      expected_slippage_bps: scenario === "slippage" ? 200 : 0,
      market: {
        trigger: "new_pair",
        source_fetched_at: now * 1000,
        price_usd: qty(2),
        liquidity_usd: qty(scenario === "skipped" ? 100 : 50000),
        age_sec: qty(900),
        vol_1h_usd: qty(20000),
      },
      security: {
        assessment: "clear",
        sources_disagree: false,
        source_fetched_at: now * 1000,
        checks_raw: toRugChecks({
          ...security.checks_raw,
          ...(scenario === "missing_mint" ? { mint_auth_disabled: null } : {}),
        }),
        provenance: Object.fromEntries(
          Object.keys(security.checks_raw).map((k) => [k, { source: "fixture", ok: true, fetched_at: now * 1000 }]),
        ),
      },
    });
    const equity = new Equity(100000),
      positions = new Positions(),
      events: AuditEvent[] = [];
    if (scenario === "drawdown") equity.close({ ...id, cost_cents: 20000, entry_price_usd: 1 }, 0, now * 1000 - 1000);
    assert.equal(
      await runCandidate(snapshot, {
        call,
        positions,
        equity,
        maxPositionBps: 100,
        maxOpenPositions: 1,
        now: () => clock,
        audit: async (e) => {
          events.push(e);
          if (scenario === "stale_equity" && e.stage === "equity-curve") clock += 61000;
        },
      }),
      "skipped",
    );
    const reasons = {
      skipped: "scanner_rejected",
      missing_mint: "risk_not_clear",
      stale_equity: "sizer_refused",
      drawdown: "sizer_halted",
      slippage: "executor_rejected",
    };
    assert.deepEqual(events.at(-1)?.gaps, [reasons[scenario]]);
    assert.equal(positions.count, 0);
    assert.equal(
      names.at(-1),
      { skipped: "scanner", missing_mint: "rug-check", stale_equity: "sizer", drawdown: "sizer", slippage: "executor" }[
        scenario
      ],
    );
  });
}
