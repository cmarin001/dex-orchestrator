import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";

export const readScope = "read:dashboard";
export const writeScope = "write:dashboard";
export const sensitiveScope = "admin:dashboard";

export type DashboardIdentity = {
  actor: string;
  scopes: Set<string>;
  mfaAt?: number;
};

const jwtConfig = z.strictObject({
  issuer: z.url().refine(value => {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin + "/" === value;
  }),
  audience: z.url(),
  clientId: z.string().trim().min(1),
  mfaClaim: z.url(),
  maxMfaAge: z.number().int().min(30).max(900),
});
export type JwtConfig = z.infer<typeof jwtConfig>;

export function dashboardJwt(config: JwtConfig, key?: JWTVerifyGetKey) {
  const { issuer, audience, clientId, mfaClaim, maxMfaAge } = jwtConfig.parse(config);
  const getKey = key ?? createRemoteJWKSet(new URL(".well-known/jwks.json", issuer), {
    timeoutDuration: 3_000,
  });
  return {
    async verify(token: string): Promise<DashboardIdentity> {
      const { payload, protectedHeader } = await jwtVerify(token, getKey, {
        issuer, audience, algorithms: ["RS256"], typ: "at+jwt",
        requiredClaims: ["sub", "exp", "iat", "jti", "client_id"],
      });
      const { sub, scope, iat, exp, client_id } = payload;
      if (protectedHeader.typ !== "at+jwt" || typeof sub !== "string" || !sub.trim() || /[\u0000-\u001f\u007f]/.test(sub) ||
        client_id !== clientId || typeof iat !== "number" || !Number.isSafeInteger(iat) || typeof exp !== "number" || !Number.isSafeInteger(exp) ||
        iat > now() + 5 || exp <= iat || exp - iat > 900) {
        throw new Error("invalid_dashboard_identity");
      }
      const mfaAt = payload[mfaClaim];
      return {
        actor: "oidc:" + JSON.stringify([issuer, sub]),
        scopes: new Set(typeof scope === "string" ? scope.split(" ") : []),
        mfaAt: typeof mfaAt === "number" && Number.isSafeInteger(mfaAt) && mfaAt > 0 && mfaAt <= iat ? mfaAt : undefined,
      };
    },
    recentMfa(identity: DashboardIdentity) {
      const at = identity.mfaAt;
      const current = now();
      return at !== undefined && at <= current && current - at <= maxMfaAge;
    },
  };
}

function now() { return Math.floor(Date.now() / 1000); }

export function dashboardAuthMode(input = "legacy") {
  return z.enum(["legacy", "dual", "auth0"]).parse(input);
}
