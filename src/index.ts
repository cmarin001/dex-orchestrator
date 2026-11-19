import { normalizeAddress, targetSchema } from "../schemas/common.js";
import { z } from "zod";
import { responsesAgent } from "./agents/call.js";
import { targetKey } from "./cache/merge.js";
import { fileAudit, replayPositions } from "./logging/logger.js";
import { runLoop } from "./orchestrator/loop.js";
import { Equity } from "./state/equity.js";
import { Positions } from "./state/positions.js";

const integer = z.coerce.number().int().positive();
const config = z.object({
  OPENAI_API_KEY: z.string().min(1),
  OPENAI_MODEL: z.string().min(1).default("gpt-4.1-mini"),
  WATCHLIST: z.string().default("[]"),
  LOOP_INTERVAL_MS: integer.max(2_147_483_647).default(90_000),
  MARKET_TTL_MS: integer.default(120_000),
  SECURITY_TTL_MS: integer.default(120_000),
  BREAKER_FAILURES: integer.default(3),
  BREAKER_COOLDOWN_MS: integer.max(2_147_483_647).default(180_000),
  INITIAL_EQUITY_CENTS: integer.default(100_000),
  MAX_POSITION_BPS: integer.max(10_000).default(100),
  MAX_OPEN_POSITIONS: integer.default(5),
  SOCIAL_ENABLED: z.enum(["true", "false"]).default("false"),
  AUDIT_PATH: z.string().min(1).default("data/audit.jsonl"),
  GOPLUS_ACCESS_TOKEN: z.string().optional(),
});

async function main(): Promise<void> {
  const env = config.parse(process.env);
  const targets = z.array(targetSchema).nonempty().parse(JSON.parse(env.WATCHLIST) as unknown)
    .map(({ chain, token, pair }) => ({ chain, token: normalizeAddress(chain, token), pair: normalizeAddress(chain, pair) }));
  const uniqueTargets = [...new Map(targets.map((target) => [targetKey(target), target])).values()];
  const equity = new Equity(env.INITIAL_EQUITY_CENTS);
  const positions = new Positions();
  for (const position of await replayPositions(env.AUDIT_PATH)) positions.record(position);
  const abort = new AbortController();
  process.once("SIGINT", () => abort.abort());
  process.once("SIGTERM", () => abort.abort());
  await runLoop({
    targets: uniqueTargets, intervalMs: env.LOOP_INTERVAL_MS,
    ttl: { marketMs: env.MARKET_TTL_MS, securityMs: env.SECURITY_TTL_MS },
    breakerFailures: env.BREAKER_FAILURES, breakerCooldownMs: env.BREAKER_COOLDOWN_MS,
    socialEnabled: env.SOCIAL_ENABLED === "true", goPlusAccessToken: env.GOPLUS_ACCESS_TOKEN,
  }, {
    call: responsesAgent(env.OPENAI_API_KEY, env.OPENAI_MODEL, abort.signal), audit: fileAudit(env.AUDIT_PATH),
    equity, positions, maxPositionBps: env.MAX_POSITION_BPS, maxOpenPositions: env.MAX_OPEN_POSITIONS,
  }, abort.signal);
}

await main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Unknown startup or orchestration failure");
  process.exitCode = 1;
});
