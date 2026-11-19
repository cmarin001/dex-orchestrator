import { isAuthorized } from "../src/dashboard-api/auth.js";
import { auditSchema } from "../src/logging/types.js";
import { createDashboardApi } from "../src/dashboard-api/routes.js";

const routes = new Set(["/health", "/equity", "/journal", "/live-view", "/live-view/stream", "/trades", "/risk-config"]);

export async function GET(request: Request) { return handle(request); }
export async function POST(request: Request) { return handle(request); }

async function handle(request: Request) {
  const url = new URL(request.url);
  const endpoint = url.searchParams.get("endpoint") ?? "";
  if (!routes.has(endpoint)) return Response.json({ error: "not_found" }, { status: 404 });
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
    return fetch(target, { method: request.method, redirect: "error", signal: request.signal,
      headers: { Authorization: request.headers.get("Authorization") ?? "",
        "Content-Type": "application/json" }, ...(request.method === "POST" ? { body: await request.text() } : {}) });
  }
  const api = createDashboardApi({
    token, auditPath: "", riskPath: "", initialCents: Number(process.env.INITIAL_EQUITY_CENTS ?? 100000),
    readOnly: true,
    events: async () => {
      const journalUrl = process.env.DASHBOARD_JOURNAL_URL;
      if (!journalUrl) throw new Error("Journal reader is not configured");
      const target = new URL(journalUrl);
      if (target.protocol !== "https:") throw new Error("Journal reader must use HTTPS");
      const secret = process.env.DASHBOARD_JOURNAL_READ_TOKEN;
      const response = await fetch(target, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(5000),
        headers: secret ? { Authorization: "Bearer " + secret } : {} });
      if (!response.ok) throw new Error("Journal read failed");
      return (await response.text()).split("\n").filter(Boolean).map(line => auditSchema.parse(JSON.parse(line)));
    },
  });
  url.pathname = endpoint;
  return api.fetch(new Request(url, request));
}
