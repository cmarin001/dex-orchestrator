import { isAuthorized } from "../src/dashboard-api/auth.js";
import { auditSchema } from "../src/logging/types.js";
import { logHttp, observe } from "../src/logging/operational.js";
import { createDashboardApi, dashboardRoutes } from "../src/dashboard-api/routes.js";

export async function GET(request: Request) { return logged(request); }
export async function POST(request: Request) { return logged(request); }
export async function OPTIONS(request: Request) { return logged(request); }

function logged(request: Request) {
  const endpoint = new URL(request.url).searchParams.get("endpoint") ?? "";
  const route = dashboardRoutes.has(endpoint) ? endpoint : "unknown";
  return logHttp("/api/dashboard-data" + (route === "unknown" ? "" : route), request.method, () => withCors(request));
}

async function withCors(request: Request): Promise<Response> {
  const origin = request.headers.get("Origin");
  const allowedOrigin = process.env.DASHBOARD_ORIGIN;
  const isAllowed = origin !== null && origin === allowedOrigin;
  if (request.method === "OPTIONS") {
    if (!isAllowed) return new Response(null, { status: 403, headers: { Vary: "Origin" } });
    return new Response(null, { status: 204, headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Vary": "Origin",
    } });
  }
  const response = await handle(request);
  const headers = new Headers(response.headers);
  headers.delete("Access-Control-Allow-Origin");
  headers.delete("Access-Control-Allow-Credentials");
  headers.append("Vary", "Origin");
  if (isAllowed && origin) headers.set("Access-Control-Allow-Origin", origin);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function handle(request: Request) {
  const url = new URL(request.url);
  const endpoint = url.searchParams.get("endpoint") ?? "";
  if (!dashboardRoutes.has(endpoint)) return Response.json({ error: "not_found" }, { status: 404 });
  const token = process.env.DASHBOARD_API_TOKEN;
  if (!token) return Response.json({ error: "dashboard_not_configured" }, { status: 503 });
  if (!isAuthorized(request.headers.get("authorization") ?? undefined, token)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: { "WWW-Authenticate": "Bearer" } });
  }
  url.searchParams.delete("endpoint");
  const upstream = process.env.DASHBOARD_WORKER_API_URL;
  if (upstream) {
    const target = new URL(upstream);
    if (target.protocol !== "https:" || target.username || target.password) {
      return Response.json({ error: "invalid_worker_url" }, { status: 503 });
    }
    target.pathname = target.pathname.replace(/\/$/, "") + endpoint;
    target.search = url.search;
    return observe("dashboard.worker_request", {}, async () => fetch(target, { method: request.method, redirect: "error", signal: request.signal,
      headers: { Authorization: request.headers.get("Authorization") ?? "",
        "Content-Type": "application/json" }, ...(request.method === "POST" ? { body: await request.text() } : {}) }));
  }
  const api = createDashboardApi({
    token, auditPath: "", riskPath: "", initialCents: Number(process.env.INITIAL_EQUITY_CENTS ?? 100000),
    readOnly: true,
    events: () => observe("dashboard.journal_request", {}, async () => {
      const journalUrl = process.env.DASHBOARD_JOURNAL_URL;
      if (!journalUrl) throw new Error("Journal reader is not configured");
      const target = new URL(journalUrl);
      if (target.protocol !== "https:") throw new Error("Journal reader must use HTTPS");
      const secret = process.env.DASHBOARD_JOURNAL_READ_TOKEN;
      const response = await fetch(target, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(5000),
        headers: secret ? { Authorization: "Bearer " + secret } : {} });
      if (!response.ok) throw new Error("Journal read failed");
      return (await response.text()).split("\n").filter(Boolean).map(line => auditSchema.parse(JSON.parse(line)));
    }),
  });
  url.pathname = endpoint;
  return api.fetch(new Request(url, request));
}
