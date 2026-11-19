import { timingSafeEqual } from "node:crypto";
import { createMiddleware } from "hono/factory";

export function isAuthorized(header: string | undefined, token: string) {
  const expected = Buffer.from("Bearer " + token);
  const actual = Buffer.from(header ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function bearerAuth(token: string) {
  if (!token.trim()) throw new Error("DASHBOARD_API_TOKEN is required");
  return createMiddleware(async (context, next) => {
    if (!isAuthorized(context.req.header("Authorization"), token)) {
      context.header("WWW-Authenticate", "Bearer");
      return context.json({ error: "unauthorized" }, 401);
    }
    await next();
  });
}
