import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";
import { CandidateError, SystemError } from "../orchestrator/errors.js";

type Level = "debug" | "info" | "warn" | "error";
const rank: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
type Context = { request_id?: string; run_id?: string; chain?: string };
type Fields = {
  component?: string;
  stage?: string;
  outcome?: string;
  duration_ms?: number;
  status?: number;
  method?: string;
  route?: string;
  provider?: string;
  attempt?: number;
  count?: number;
  failure_kind?: string;
  gap_count?: number;
  reason?: string;
  market_cache_hit?: boolean;
  security_cache_hit?: boolean;
  cooldown_ms?: number;
} & Context;

const context = new AsyncLocalStorage<Context>();

export function withLogContext<T>(fields: Context, callback: () => T): T {
  return context.run({ ...context.getStore(), ...fields }, callback);
}

export function failureKind(error: unknown): string {
  if (error instanceof CandidateError) return "candidate";
  if (error instanceof SystemError) return "system";
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.name === "TimeoutError") return "aborted";
    if (error.name === "ZodError" || error instanceof SyntaxError) return "invalid_data";
  }
  return "unexpected";
}

export const startTimer = () => performance.now();
export const elapsed = (started: number) => Math.round((performance.now() - started) * 100) / 100;

export function log(level: Level, event: string, fields: Fields = {}) {
  const configured = process.env.LOG_LEVEL;
  if (configured === "silent") return;
  const minimum = configured === "debug" || configured === "warn" || configured === "error" ? configured : "info";
  if (rank[level] < rank[minimum]) return;
  const line = JSON.stringify({ at: new Date().toISOString(), level, event, ...context.getStore(), ...fields });
  if (level === "error" || level === "warn") console.error(line);
  else console.log(line);
}

export async function observe<T>(event: string, fields: Fields, fn: () => Promise<T>, level: Level = "debug") {
  const started = startTimer();
  try {
    const value = await fn();
    log(level, event, { ...fields, duration_ms: elapsed(started), outcome: "ok" });
    return value;
  } catch (error) {
    const failure_kind = failureKind(error);
    log(failure_kind === "candidate" || failure_kind === "aborted" ? "warn" : "error", event, {
      ...fields, duration_ms: elapsed(started), outcome: "failed", failure_kind,
    });
    throw error;
  }
}

export function logHttp(route: string, method: string, next: () => Promise<Response>) {
  const active = context.getStore()?.request_id;
  // A Vercel gateway and its in-process Hono handler represent the same request.
  if (active) return next();
  const request_id = randomUUID();
  const safeMethod = ["GET", "POST", "OPTIONS", "HEAD", "PUT", "PATCH", "DELETE"].includes(method) ? method : "OTHER";
  return withLogContext({ request_id }, async () => {
    const started = startTimer();
    try {
      const response = await next();
      const status = response.status;
      log(status >= 500 ? "error" : status >= 400 ? "warn" : "info", "http.request", {
        route, method: safeMethod, status, duration_ms: elapsed(started),
      });
      return response;
    } catch (error) {
      log("error", "http.request", { route, method: safeMethod, duration_ms: elapsed(started), failure_kind: failureKind(error) });
      throw error;
    }
  });
}
