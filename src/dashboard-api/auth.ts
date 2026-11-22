import { timingSafeEqual } from "node:crypto";
import { createMiddleware } from "hono/factory";
import { type dashboardJwt, readScope, writeScope, type DashboardIdentity } from "./jwt.js";

export function isAuthorized(header: string | undefined, token: string) {
  const expected = Buffer.from("Bearer " + token);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type DashboardAuthEnv = {
  Variables: { dashboardActor: string; dashboardIdentity?: DashboardIdentity };
};

export function dashboardAccess(options: {
  token?: string;
  actor?: string;
  jwt?: ReturnType<typeof dashboardJwt>;
}) {
  if (!options.token?.trim() && !options.jwt) throw new Error("DASHBOARD_API_TOKEN is required");
  return createMiddleware<DashboardAuthEnv>(async (c, next) => {
    const header = c.req.header("Authorization");
    if (options.token?.trim() && isAuthorized(header, options.token)) {
      // The migration credential can observe the API, while OAuth owns all writes.
      if (options.jwt && c.req.method !== "GET") return c.json({ error: "insufficient_scope" }, 403);
      c.set("dashboardActor", options.actor ?? "operator");
      return next();
    }
    if (options.jwt && header?.startsWith("Bearer ") && header.length <= 8192) {
      let identity: DashboardIdentity;
      try { identity = await options.jwt.verify(header.slice(7)); }
      catch {
        c.header("WWW-Authenticate", 'Bearer error="invalid_token"');
        return c.json({ error: "unauthorized" }, 401);
      }
      if (!identity.scopes.has(c.req.method === "GET" ? readScope : writeScope)) {
        return c.json({ error: "insufficient_scope" }, 403);
      }
      c.set("dashboardIdentity", identity);
      c.set("dashboardActor", identity.actor);
      return next();
    }
    c.header("WWW-Authenticate", "Bearer");
    return c.json({ error: "unauthorized" }, 401);
  });
}
