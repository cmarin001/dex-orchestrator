# Backend implementation requirements

The backend [contract](./frontend-api-contract.md) is the review gate. The present browser code needs no changes for this phase.

| Priority | Required work | Acceptance test |
| --- | --- | --- |
| P0 | Build emergency kill switch, breaker reset and exits pause/resume controls | Persist a kill command with health failing; keep entries and live sends blocked after restart; report per-position flatten results. Protective exits remain available. |
| P0 | Add actor-scoped receipt lookup and normalize alias idempotency | Verify 202 on durable acceptance, queued/applied/rejected lookup, replay with same ID, and 409 on conflicting reuse. |
| P0 | Add trading limits plus atomic risk/limits updates | Validate whole request first; enforce per-trade and per-day entry caps in worker for new orders; reject stale revisions and require elevated authorization for increases. |
| P0 | Add quote and paper manual trade | Reject unknown assets and unmatched sells; verify quote ownership, expiry and one-use behavior; prove paper orders never reach a live signer. |
| P1 | Add versioned trades, chains, mode and strategy aliases | Preserve existing route contracts and apply aliases to the same normalized action and receipt. |
| P1 | Add performance, funnel and system health projections and extend existing reads | Verify ranges, dedup, journal-derived metrics, nullable unavailable values and output shapes. Add stable IDs for diagnostics and exports. |
| P1 | Add provider order and reconciliation | Reject stale provider revisions; reconcile with audit results and no side effects on trading. |
| P1 | Generate and lint OpenAPI 3.1 | Add tests for every operation, including existing reused routes and exact 202 receipt shapes. |
