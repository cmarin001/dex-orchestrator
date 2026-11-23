import { serve } from "@hono/node-server";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDashboardApi } from "../src/dashboard-api/routes.js";

const directory = await mkdtemp(join(tmpdir(), "dex-safety-browser-"));
const auditPath = join(directory, "audit.jsonl");
const apiLogPath = join(directory, "api-log.jsonl");
const api = createDashboardApi({ token: "safety-browser-fixture", auditPath, apiLogPath,
  riskPath: join(directory, "risk.jsonl"), initialCents: 0, events: async () => [] });
const paths = new Set(["/api/v1/controls/emergency-stop", "/api/v1/controls/flatten", "/api/v1/controls/disarm-signer"]);
const server = serve({ hostname: "127.0.0.1", port: Number(process.env.SAFETY_FIXTURE_PORT ?? 8789), async fetch(request) {
  const path = new URL(request.url).pathname;
  if (path === "/api/v1/status") return Response.json({ error: "injected_status_failure" }, { status: 500 });
  if (path === "/api/v1/health") return Response.json({ ok: true, journal_readable: true });
  if (request.method !== "POST" || !paths.has(path)) return Response.json({}, { status: 404 });
  const headers = new Headers(request.headers);
  headers.set("Authorization", "Bearer safety-browser-fixture");
  return api.fetch(new Request(request, { headers }));
} }, info => console.log(`Safety test fixture on ${info.port}; API log at ${apiLogPath}`));
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => server.close(() => { void rm(directory, { recursive: true, force: true }); }));
}
