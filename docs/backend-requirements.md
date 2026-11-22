# Backend requirements for the beam-arrow desk

This is the gap list for [contract review](./frontend-api-contract.md). Existing paths stay in service while the connection architecture is decided.

| Priority | Gap | Exit criterion |
| --- | --- | --- |
| P0 | No orchestrator transport or session in the desk | Agree on a separately authorized frontend/BFF wiring change or keep the desk simulated. Verify existing reads before any mutation. |
| P0 | Emergency stop and flatten have no durable command | Approve a single safe intake, idempotency, safe state on worker outage and explicit per-position outcomes. No dependency on another endpoint’s health check. |
| P0 | Receipt lifecycle is incompatible | Map server queued/applied/rejected states and actor/request ID to the UI; test replays and conflicts. |
| P0 | Manual quote and submit lack a verified execution contract | Resolve paper scope, canonical identity, quote expiry, side, price/slippage constraints and provider support. Only use a signed execution path after separate authorization. |
| P0 | Risk dollars, trading caps, chain selection and registry IDs differ | Respect existing schema, distinguish provider budget, and specify actual supported caps and chain capabilities. |
| P1 | Breaker reset, automated exits pause/resume and provider order are local only | Define validated worker command semantics, emergency interactions and idempotency. |
| P1 | Position details, performance, live audit, funnel and system metrics exceed available measured data | Reuse journal data where available. Publish only defined measurements with units and missing-data treatment. |
| P1 | Coverage lists plural chains, versioned trades, controls/mode and strategy aliases | Approve reuse of existing routes or justify a compatibility alias before implementing it. |
| P2 | Coverage lists reconcile without a caller; no candidates, stream, provider-budget or filter editor in the desk | Keep out of endpoint implementation until a real caller and a reviewed request/response shape exists. |
