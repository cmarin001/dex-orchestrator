import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { TestContext } from "node:test";
import { responsesAgent } from "../src/agents/call.js";
import type { Handoff } from "../schemas/common.js";

export const now = 1795200000;
export const id: Handoff = {
  run_id: "smoke",
  chain: "base",
  token: "0x" + "1".repeat(40),
  pair: "0x" + "2".repeat(40),
};
const { chain, token, pair } = id;
export const feed = {
  chain,
  token,
  pair,
  trigger: "new_pair" as const,
  liquidity_usd: 50000,
  vol_1h_usd: 20000,
  age_sec: 900,
};
export const scan = { ...id, ...feed, discovered_at: now, rank_score: 1, reason: "new_pair", skipped: false };
export const raw = {
  renounced: 1,
  mint_auth_disabled: 1,
  freeze_auth_disabled: 1,
  lp_locked_or_burned: 1,
  honeypot_sim_ok: 1,
  blacklist_present: 0,
  deployer_rugged_before: null,
  holder_count: 100,
  holder_top10_pct: 10,
  tax_bps: 0,
};
export const checks = {
  renounced: true,
  mint_auth: true,
  freeze_auth: true,
  lp_locked_or_burned: true,
  honeypot: true,
  tax_ok: true,
  blacklist: true,
  deployer_ok: true,
  age_ok: true,
  holder_conc_ok: true,
};
export const rug = { ...id, verdict: "PASS" as const, checks, reason: "non-critical deployer history unavailable" };
export const limits = {
  min_liquidity_usd: 10000,
  min_vol_1h_usd: 5000,
  min_age_sec: 600,
  top_n: 20,
  dedup_window_sec: 3600,
};
export const sizing = {
  ...id,
  status: "SIZED" as const,
  size_usd: 20,
  size_tokens: 10,
  max_slippage_bps: 150,
  equity_at_decision: 1000,
  equity_age_sec: 0,
  risk_pct_used: 0.02,
  reason: "1000 × 0.02 = 20",
};
export const portfolio = {
  equity_usd: 1000,
  drawdown_pct: 0,
  trades_closed: 0,
  win_rate: 0,
  expectancy_usd: 0,
  as_of: now,
};
export const fill = {
  ...id,
  action: "entry",
  status: "FILLED",
  fill_price: 2,
  size_usd: 10,
  gas_usd: 0,
  slippage_bps: 0,
  tx_hash: "sim",
  reason: "paper fill",
};
export const provenance = {
  goplus: { ok: true, fetched_at: now },
  honeypot_is: { ok: true, fetched_at: now },
  etherscan: { ok: false, fetched_at: now },
  rugcheck: { ok: false, fetched_at: now, applicable: false },
};
export const security = {
  ...id,
  checks_raw: raw,
  provenance,
  sources_disagree: false,
  confidence: "high",
  reason: "fixture",
};
export const market = {
  ...id,
  ...feed,
  discovered_at: now,
  source: "geckoterminal",
  source_fetched_at: now,
  skipped: false,
  reason: "new_pair",
};
type Body = {
  instructions: string;
  input: Array<{ type?: string; content?: string; output?: string }>;
  tools: Array<{ name: string; parameters: { properties: Record<string, { const: unknown }> } }>;
  text: { format: { name: string } };
};
type Reply = (name: string, data: unknown, body: Body) => unknown;
export function mockApi(t: TestContext, reply: Reply) {
  const names: string[] = [];
  t.mock.method(Date, "now", () => now * 1000);
  t.mock.method(globalThis, "fetch", async (url: unknown, init: RequestInit) => {
    assert.equal(String(url), "https://api.openai.com/v1/responses");
    const body: Body = JSON.parse(String(init.body));
    const name = body.text.format.name;
    assert.equal(body.instructions, readFileSync(new URL("../prompts/" + name + ".md", import.meta.url), "utf8"));
    const index = body.input.filter((item) => item.type === "function_call_output").length;
    const tool = body.tools.filter((t) => t.name !== "dexscreener_token")[index];
    const args = tool && Object.fromEntries(Object.entries(tool.parameters.properties).map(([k, v]) => [k, v.const]));
    if (!tool) names.push(name);
    const output = tool
      ? [{ type: "function_call", name: tool.name, arguments: JSON.stringify(args), call_id: "call" + index }]
      : [
          {
            type: "message",
            role: "assistant",
            content: [
              { type: "output_text", text: JSON.stringify(reply(name, JSON.parse(body.input[0]!.content!), body)) },
            ],
          },
        ];
    return Response.json({ status: "completed", output });
  });
  return { call: responsesAgent("fixture", "fixture"), names };
}
export function pinnedPrompt(name: string, digest: string) {
  assert.equal(
    createHash("sha256")
      .update(readFileSync(new URL("../prompts/" + name + ".md", import.meta.url)))
      .digest("hex"),
    digest,
  );
}

export const geckoResponse = {
  data: [
    {
      attributes: {
        address: id.pair,
        reserve_in_usd: "50000",
        volume_usd: { h1: "20000" },
        pool_created_at: new Date((now - 900) * 1000).toISOString(),
      },
      relationships: { base_token: { data: { id: "base_" + id.token } } },
    },
  ],
};
export const securityProvider: typeof fetch = async (url) =>
  Response.json(
    String(url).includes("goplus")
      ? {
          code: 1,
          result: {
            [id.token]: {
              is_renounced: "1",
              is_mintable: "0",
              is_freezable: "0",
              lp_locked_or_burned: 1,
              is_honeypot: "0",
              is_blacklisted: "0",
              top10_holder_pct: 10,
              holder_count: "100",
              buy_tax: "0",
              sell_tax: "0",
            },
          },
        }
      : {
          simulationSuccess: true,
          honeypotResult: { isHoneypot: false },
          token: { address: id.token },
          pair: { pair: { address: id.pair } },
          chain: { id: "8453" },
        },
  );
