import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { generateKeyPair, SignJWT } from "jose";
import { createDashboardApi } from "../../src/dashboard-api/routes.js";
import { dashboardJwt } from "../../src/dashboard-api/jwt.js";
import { defaultRisk } from "../../schemas/risk-config.js";

const issuer = "https://tenant.example/";
const audience = "https://api.tradekeel.example";
const clientId = "approved-web-app";
const mfaClaim = "https://tradekeel.example/claims/mfa_at";
const { publicKey, privateKey } = await generateKeyPair("RS256");
const otherKey = (await generateKeyPair("RS256")).privateKey;
const current = Math.floor(Date.now() / 1000);
const all = "read:dashboard write:dashboard admin:dashboard";

function accessToken(input: {
  iss?: string; aud?: string; client?: string; typ?: string; exp?: number;
  scope?: string; mfa?: number; wrongKey?: boolean; sub?: string;
} = {}) {
  const claims = { scope: input.scope ?? all, client_id: input.client ?? clientId,
    ...(input.mfa === undefined ? {} : { [mfaClaim]: input.mfa }) };
  return new SignJWT(claims).setProtectedHeader({ alg: "RS256", typ: input.typ ?? "at+jwt" })
    .setIssuer(input.iss ?? issuer).setAudience(input.aud ?? audience).setSubject(input.sub ?? "auth0|operator-a")
    .setJti("token-id").setIssuedAt(current).setExpirationTime(input.exp ?? current + 600)
    .sign(input.wrongKey ? otherKey : privateKey);
}

test("verifies RFC 9068 access tokens and enforces permissions, MFA and audit identity", async t => {
  const directory = await mkdtemp(join(tmpdir(), "dex-jwt-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const jwt = dashboardJwt({ issuer, audience, clientId, mfaClaim, maxMfaAge: 300 }, async () => publicKey);
  const options = { jwt, initialCents: 100_000, auditPath: join(directory, "audit.jsonl"), riskPath: join(directory, "risk.jsonl"), events: async () => [] };
  const app = createDashboardApi(options);
  const dual = createDashboardApi({ ...options, token: "old-shared-token", actor: "legacy" });
  const read = "/api/v1/status";
  const arm = "/api/v1/controls/live-execution";
  const risk = "/api/v1/controls/risk";
  const req = (token: string, route = read, body?: object, target = app) => target.request(route, {
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json", "X-Actor": "forged" },
    ...(body ? { method: "POST", body: JSON.stringify(body) } : {}),
  });
  for (const bad of [
    { iss: "https://other.example/" }, { aud: "https://other-api.example" }, { client: "other-app" },
    { typ: "JWT" }, { exp: current - 1 }, { exp: current + 901 }, { wrongKey: true },
  ]) assert.equal((await req(await accessToken(bad))).status, 401);
  assert.equal((await req("old-shared-token")).status, 401);
  assert.equal((await req("old-shared-token", read, undefined, dual)).status, 200);
  assert.equal((await req("old-shared-token", "/api/v1/controls/pause", {}, dual)).status, 403);
  const reader = await accessToken({ scope: "read:dashboard" });
  assert.equal((await req(reader)).status, 200);
  assert.equal((await req(reader, "/api/v1/controls/pause", {})).status, 403);
  const noAdmin = await accessToken({ scope: "read:dashboard write:dashboard", mfa: current });
  assert.equal((await req(noAdmin, arm, { enabled: true })).status, 403);
  for (const mfa of [undefined, current - 301, current + 1]) {
    const token = await accessToken({ mfa });
    const denied = await req(token, arm, { enabled: true });
    assert.equal(denied.status, 403);
    assert.equal((await denied.json()).error, "recent_mfa_required");
    assert.equal((await req(token, risk, { config: defaultRisk })).status, 403);
    assert.equal((await req(token, "/risk-config", defaultRisk)).status, 403);
    assert.equal((await req(token, "/api/v1/strategies/reload", {})).status, 403);
  }
  assert.equal((await req(await accessToken(), arm, { enabled: false })).status, 202);
  const approved = await accessToken({ mfa: current - 10 });
  const armBody = { enabled: true, request_id: "same-request" };
  const result = await req(approved, arm, armBody);
  assert.equal(result.status, 202);
  const receipt = await result.json();
  assert.equal(receipt.actor, 'oidc:["https://tenant.example/","auth0|operator-a"]');
  assert.deepEqual(await (await req(approved, arm, armBody)).json(), receipt);
  assert.equal((await req(await accessToken({ mfa: current, sub: "auth0|operator-b" }), arm, armBody)).status, 409);
  assert.equal((await req(approved, risk, { config: defaultRisk })).status, 202);
});
