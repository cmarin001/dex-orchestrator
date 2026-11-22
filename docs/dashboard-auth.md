# Phase 5 dashboard authentication

The TradeKeel dashboard uses a same-origin Auth0 BFF that holds OAuth tokens
server-side. Its deployment instructions and Auth0 Actions are in
[dex-orchestrator-app](https://github.com/cmarin001/dex-orchestrator-app/blob/phase-5-auth/deploy/auth0/README.md).
The worker, signer, control command format, ledger and prompts are unchanged.

| Configuration | REST | MCP HTTP | MCP stdio |
|---|---|---|---|
| `DASHBOARD_AUTH_MODE=legacy` (default) | Shared token, existing reads and writes | Existing shared-token access | Existing tools |
| `dual` | Auth0 scopes and MFA policy, shared token for reads only | Shared token, read-only tools | Read-only tools |
| `auth0` | Auth0 JWT only | Disabled (401) | Read-only tools |

In an Auth0 deployment keep REST and MCP on loopback. In dual mode any
legacy machine access should use the private listener, for example via an
SSH tunnel. The BFF forwards only its own access token to REST. The
`/internal/health` endpoint supports the loopback container health probe.
It exposes no account data and is outside the public proxy allowlist.

## Verification

Configure the exact issuer (HTTPS, trailing slash), audience, approved
confidential BFF client ID, and namespaced MFA claim as shown in
[.env.example](../.env.example). The API accepts RS256 RFC 9068 tokens,
requires `at+jwt`, and checks the token's issuer, audience, client ID,
subject, issue and expiry times, and token ID. JWKS is cached and fetched
over HTTPS. A failed verification returns 401. Missing permissions or
fresh MFA return 403.

- `read:dashboard` grants reads, including the SSE and trade-history reads.
- `write:dashboard` grants pause, resume, disarm, exit and token rejection.
- `write:dashboard` plus `admin:dashboard` and recent MFA are required for
  live-arm, risk revisions, and advanced operating controls such as
  strategy, signal, chain, or provider changes. The API requires this
  for every risk revision because it cannot safely classify a pending
  revision relative to others queued concurrently. Both risk write
  paths enforce the same policy. MFA must precede token issuance and
  remain within the configured window (default five minutes).

The receipt actor is derived from the verified issuer and subject.
Policy is checked when a command is submitted or its receipt is
retrieved. The worker retains its existing next-cycle queue semantics.
Logging out or revoking a session blocks new commands through the
session. Previously queued commands remain in the inbox and may still
apply. An operator whose MFA expired may sign in again to check an
elevated receipt using the same actor, request ID and payload.

The production host verification script checks the HTTPS auth boundary
and loopback liveness. In JWT-only mode it also checks the unauthenticated
BFF session endpoint. An authenticated paper-mode pilot against the real
staging tenant is a separate gate. Before decommissioning the shared
token, inventory and migrate or retire all existing REST and MCP machine
clients. Phase 5 does not provision machine OAuth clients.
