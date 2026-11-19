import { randomUUID, timingSafeEqual } from "node:crypto";
import { join } from "node:path";
import type { Handoff } from "../schemas/common.js";
import { normalizeAddress, targetSchema } from "../schemas/common.js";
import { responsesAgent } from "../src/agents/call.js";
import { reconA } from "../src/agents/recon-a.js";
import { reconB } from "../src/agents/recon-b.js";
import { merge } from "../src/cache/merge.js";
import type { AuditEvent } from "../src/logging/types.js";
import { failureKind, log, logHttp, withLogContext } from "../src/logging/operational.js";
import { CandidateError } from "../src/orchestrator/errors.js";
import { runCandidate } from "../src/orchestrator/pipeline.js";
import { Equity } from "../src/state/equity.js";
import { Positions } from "../src/state/positions.js";

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });

function authorized(request: Request, secret: string): boolean {
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET() {
  return logHttp("/api/paper", "GET", async () => json({ service: "dex-orchestrator", mode: "paper-preview", execution: "on-demand",
    configured: Boolean(process.env.OPENAI_API_KEY && process.env.PAPER_RUN_SECRET &&
      process.env.PAPER_RUN_TARGET) }));
}

export async function POST(request: Request) {
  return logHttp("/api/paper", "POST", () => runPaper(request));
}

async function runPaper(request: Request) {
  const secret = process.env.PAPER_RUN_SECRET;
  if (!secret || !authorized(request, secret)) {
    return json({ error: "unauthorized" }, 401, { "www-authenticate": "Bearer" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  let target;
  try {
    target = targetSchema.parse(JSON.parse(process.env.PAPER_RUN_TARGET ?? "null"));
  } catch {
    return json({ error: "paper_runner_not_configured" }, 503);
  }
  if (!apiKey) return json({ error: "paper_runner_not_configured" }, 503);

  const { chain } = target;
  const identity = { run_id: randomUUID(), chain, token: normalizeAddress(chain, target.token),
    pair: normalizeAddress(chain, target.pair) };
  return withLogContext({ run_id: identity.run_id, chain }, () => executePaper(identity, request, apiKey));
}

async function executePaper(identity: Handoff, request: Request, apiKey: string) {
  const signal = AbortSignal.any([request.signal, AbortSignal.timeout(80_000)]);
  const call = responsesAgent(apiKey, process.env.OPENAI_MODEL || "gpt-4.1-mini", signal,
    join(process.cwd(), "prompts"));
  const events: AuditEvent[] = [];

  try {
    const [market, security] = await Promise.all([
      reconA(call, identity), reconB(call, identity, undefined, process.env.GOPLUS_ACCESS_TOKEN),
    ]);
    const input = merge(identity, market, security, undefined, { marketMs: 120_000, securityMs: 120_000 });
    const outcome = await runCandidate(input, {
      call, signal, audit: async (event) => { events.push(event); },
      equity: new Equity(100_000), positions: new Positions(), maxPositionBps: 100, maxOpenPositions: 1,
    });
    log("info", "paper.completed", { outcome });
    return json({ identity, outcome, events });
  } catch (error) {
    log("warn", "paper.failed", { failure_kind: signal.aborted ? "aborted" : failureKind(error) });
    if (signal.aborted) return json({ identity, error: "invocation_timed_out", events }, 504);
    if (error instanceof CandidateError) return json({ identity, outcome: "skipped", events });
    return json({ identity, error: "provider_or_pipeline_unavailable", events }, 502);
  }
}
