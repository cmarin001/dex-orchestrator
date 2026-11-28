# Modular platform engineering report

The starting point was a fresh clone of `main` at `13b93732889d067d3853689c8e9872f937fa47b1`, the merge of PR #27. The working tree was clean, and the target checkout contained no `AGENTS.md` files. The implementation is on `architecture/modular-intelligence`. No other worktrees were edited. The historical baseline was measured on Node v24.22.3 after a lockfile install.

## Discovery and gap analysis

| Phase | Baseline finding | Implemented and locally testable | Remaining work |
| --- | --- | --- | --- |
| 0. Baseline | Main already had the nine immutable prompts, deterministic strategies, normalized handoffs, REST/MCP, JSONL audit, control receipts, a wallet signer and deployment scripts. | Inspected repository and ran baseline build, lint, tests, simulations, harness generation, route inventory and deploy timing checks. | Collect a representative market tape and an operational baseline from a paper deployment. |
| 1. Boundaries | Composition existed in the worker entry point, with provider-specific integrations in legacy Recon and wallet code. | Separate reasoning, typed decision and research runtime contracts, validated market mark port, pure paper-cost rules and dependency/cycle tests. | Generalize full market discovery/security evidence, RPC and quote composition, journal/cache backends and telemetry exporters. No notification subsystem existed in the worker. |
| 2. Reasoning | Four fixed config entries used one Chat Completions adapter with budget reservations and fallback. | Configurable compatible endpoints, model-scoped capabilities, text and SSE, strict vs locally validated JSON, continuation fields, bounded HTTP, endpoint credential checks, response/failure telemetry and budget-aware failover. | Validate exact live model capability combinations, server-side billing, protocol nuances, paid timeout behavior and tuning. Routing uses one attempt per provider per workflow attempt and a cooldown. Multiple retries with exponential jitter are a follow-up. |
| 3. Typed decisions | No typed provider, interface, calibration or shadow evidence. | Dedicated Jev Gateway adapter, deterministic and mock providers, paper entry gate, separately budgeted shadow observation, modeled labels and statistical report. Shadow supports deterministic or Jev configuration. | Run authenticated Jev conformance and collect sufficient time-ordered labels. No external decision can affect trading through the new wiring. |
| 4. Hermes | Existing server-side local harness, relevant docs and a three-hop acceptance script. | Separate runtime API client with loopback, scoped configuration, typed advisory results, optional native or no-op fallback, real local stdio read-only conformance. | Verify an actual pinned Hermes runtime, tool restrictions, declared inference providers and correlated forwarding. |
| 5. Fast/slow paths | Position watcher used the model-capable agent dispatcher for exit recommendation and subsequent projections. | Exit handling, Logger and Equity Curve use local handoffs. Stop-loss checks permit deterministic guards only. Research and replay are standalone. Shadow queue admission does not wait for inference. | Confirm market feed and pending RPC delays under production-like load. Legacy optional AI modes still call reasoning in entry workflow and Recon. |
| 6. Learning | Paper marked at the input quote with zero fees/slippage. No offline evaluation tools. | Optional per-leg paper costs, rehydratable cost basis, chronological replay, walk-forward parameter selection, net metrics and calibration without automatic promotion. | Ingest complete point-in-time data, including delisted/dead pools. Model availability, latency, quote impact, failed swap fees, partial fills and liquidity constraints from replayable observations. Strategy attribution and proposal/promotion remain operator workflows. |
| 7. Performance | Existing pipeline stage telemetry, no reproducible candidate benchmark. | Synthetic candidate benchmark against both revisions records percentiles, throughput, CPU, RSS, GC and event-loop delay. | Collect network request, quote, RPC, serialization, signer and confirmation distributions on representative workloads before optimization. |
| 8. Production readiness | One writer per journal and existing deployment/rollback and emergency controls. | Risk recheck after approval, broadcast recheck after signing journal append, secret scope defenses, isolated offline research profile and regression coverage. | Validate image/Compose on a representative host, prove provider data handling and real reconciliation against test-chain infrastructure, and complete risk/version binding. |

## Preserved behavior and deliberate corrections

- All nine prompt files and stage contracts remain present. Merge and TTL cache, deterministic strategies and the control and journal paths are reused. No REST or MCP mount or tool schema was changed.
- A configured stop loss could previously wait on a model or strategy advisory and could be interrupted by a model failure. The watcher now permits deterministic guard checks for such stops and runs its standard exit handoffs locally. Forced manual exits still have priority and retain signer enforcement. This also removes paid post-close analysis from the watcher.
- Approval previously happened after the last risk refresh. Entry now refreshes current limits after authorization and checks slippage, drawdown, position limits, freshness and pause state before proceeding. The approval receipt can be consumed before a refreshed limit causes an entry to be skipped.
- A pause or arming change could land while the signer durably wrote the signed identifier. The signer now rechecks expiry, safety state, arming and deployment authorization immediately before broadcast. If that last check rejects a locally signed attempt, it explicitly journals that it withheld broadcast. Receipts of already submitted transactions still reconcile through the existing path.
- The optional paper model charges both sides, caps initial spend at the approved commitment, preserves historic position economics across restart and marks estimated net liquidation proceeds. Legacy paper accounting stays active without `PAPER_COSTS`. Existing exit thresholds remain market-price triggers, so a gross target can still represent a net loss. Live quote, sizing and fee policies have no new cost-model parameter.

## Other confirmed financial modeling gaps

| Observation | Effect and disposition |
| --- | --- |
| Paper fill entry previously used the indicative quote and paper close used the latest price ratio. | Fees, slippage and per-leg fixed charges are available through the paper opt-in. Dynamic impact, transfers and failed costs are unavailable to that model. |
| Sizer inputs still set volatility and gas to zero. | The existing recommendation model has no empirical volatility or fee input at this stage. The live adapter still validates declared caps and simulation. Dynamic sizing changes require evidence and an explicit policy change. |
| Profit-only positions can remain below target indefinitely. | Confirmed and covered by legacy policy tests. Preserve the policy. Existing `stop_loss` remains the opt-in alternative. |
| Exit refresh defaults to 5,000 ms. | Confirmed. Sequential mark I/O can extend the effective sweep. Signal cancellation reaches the mark port. No latency guarantee is inferred. |
| Synthetic AI confidence can be 1 in the fallback signal created for human approval. | It is retained as legacy operator metadata. Decision calibration uses only typed predictions and later observed labels. |
| Cost accounting remains incomplete for live P&L. | Fills use settlement receipt amounts and existing caps, while full gas, priority fees and failed transaction attribution remain open. |
| Real Hermes mutation handling remains unverified. | The tested dedicated harness is read-only on discovery and invocation. No mutation integration is wired. |

## Risk evidence and gaps

The current pipeline enforces mandatory Rug Check, per-position limits, pool depth and minimum observed liquidity, mode/chain allocation, open-position count, stale market/equity checks, and portfolio drawdown capacity. The wallet validates the modeled chain, exact intent hash per request ID, deadline, slippage bounds through minimum output, simulation and declared fee caps, durable spend reservations and chain adapters. Serialized wallet state prevents duplicate processing of a known intent. Pending receipts are reconciled without treating ambiguity as absence. Bitcoin retains the existing bounded replacement policy.

Per-token exposure across several pools, comprehensive protocol fee/price-impact accounting and formal risk-revision binding at signing require further work. Existing route and signer code still contain chain-specific policies that need a full per-chain testnet conformance suite. No live transaction, signer enablement or production deployment was used for validation.

## Provider verification

| Combination or interface | Evidence |
| --- | --- |
| Kimi-like → GLM-like → DeepSeek-like → fourth compatible provider | Configuration-only local HTTP fixtures prove isolated credentials, routing, model names and capability checks. No endpoint was contacted. |
| Existing OpenAI, DeepSeek, xAI and local model paths | Shared adapter contract tests and existing integration suite. Exact deployed model IDs and capabilities are operator configuration. |
| Anthropic and Gemini | Official compatibility protocols reviewed; configure only the features the selected model documents. Live conformance tests remain outstanding. |
| Jev choice, score, predicate and abstention | Adapter fixtures based on the published Gateway Decisions protocol and the OpenAI-compatible response schema. The actual model label, billable usage and service behavior require an authenticated check. |
| Hermes API and stdio | Hermes HTTP fixture plus the real local backend stdio server over the MCP SDK. The Hermes daemon, its model selection, and native three-hop forwarding remain unverified. |
| Native/no-op research and deterministic operation | Shared runtime contract, standalone no-op CLI and existing zero-model strategies tests. Native paid inference remains unverified. |

## Test and benchmark record

| Check | Baseline | Implementation |
| --- | --- | --- |
| `npm ci` | 213 packages installed from the lockfile | No dependency change |
| `npm run lint`, `npm run build` | Pass | Pass on Node v20.19.6 |
| `npm test` | 128 pass | 153 pass on Node v20.19.6 |
| `npm run simulate` | 6 pass | 6 pass on Node v20.19.6 |
| `generate-harness-policy.mjs --check` | Pass | Pass |
| `compare-api-routes.ts` | Same planning drift in both inventories. The command reports counts without failing for documented gaps. | 13 approved REST entries without MCP tools, 51 planned REST entries absent, 5 runtime REST entries outside plan, 92 planned MCP names absent in the read-only runtime, 8 outside plan |
| `bash tests/deploy-cicd.sh`, deployment shell syntax | Pass for deploy timing and fresh-cycle checks | Pass |
| Production TypeScript emit | Build baseline passed | Pass |
| Immutable `prompts/` diff | Reference | Empty |

Baseline tests took approximately 18.1 s wall time and the standalone simulation took 1.42 s in this workspace. The benchmark uses in-process deterministic fixtures, a memory audit sink, 100 warm-up candidates and 3,000 measured candidates. It omits network and fsync. Run it with `LOG_LEVEL=silent npm run bench:candidate -- PATH_TO_CHECKOUT 3000` on the same Node version and machine while the system is idle.

| Fixture metric on Node v20.19.6 | Baseline | Implementation |
| --- | ---: | ---: |
| Wall time, 3,000 candidates | 5.42 s | 5.22 s |
| Throughput | 554/s | 575/s |
| p50 candidate latency | 1.13 ms | 1.06 ms |
| p95 candidate latency | 4.59 ms | 4.49 ms |
| p99 candidate latency | 7.62 ms | 6.67 ms |
| Process CPU time | 10.50 s | 10.20 s |
| CPU time per wall second, across threads | 1.94 s/s | 1.96 s/s |
| RSS at completion | 242.95 MiB | 235.30 MiB |
| GC time | 1.39 s | 1.36 s |
| Event-loop delay p99 | 77.14 ms | 85.59 ms |

The paired run is one sample. Two Node 24 comparisons under concurrent test load had lower throughput on the implementation checkout and higher tail variability. These measurements do not establish a performance improvement. They leave production throughput, provider latency, quote age during load, and transaction submission-to-confirmation latency unmeasured. None of these results warrants a Go or Rust extraction. Python remains an optional external Hermes runtime dependency.

## Modified files and rollout status

| Area | Files |
| --- | --- |
| Composition and pipeline | `src/index.ts`, `src/mode/{config,runtime}.ts`, `src/orchestrator/{loop,pipeline,recon-refresh}.ts`, `src/exits/{policy,watcher}.ts` |
| Existing financial boundaries | `src/state/{equity,positions}.ts`, `src/wallet/signer.ts` |
| Reasoning | `schemas/provider-config.ts`, `src/providers/{adapter,agent,router,types,composition,http,mock,stream}.ts` |
| New modules | `src/agent-runtime/`, `src/decisions/`, `src/domain/`, `src/learning/`, `src/market-data/` |
| Runtime configuration and deploy | `.env.example`, `package.json`, `deploy/docker/docker-compose.research.yml` |
| Validation | `scripts/benchmark-candidate.ts`, new integration and unit suites, additional existing signer and adapter cases |
| Reference | [Platform guide and migration](modular-platform.md), [ADR 0006](adr/0006-modular-platform.md) |

Existing JSONL events remain readable by this version. Check backward image compatibility before rollback when new paper cost or wallet withheld records exist. Use the procedure in [Deployment and rollback](modular-platform.md#deployment-and-rollback). No production migration was attempted.

The remaining external verification gates are a dedicated paid-provider test account, an isolated pinned Hermes install, Docker-enabled deployment verification, and a representative time-ordered dataset and paper workload. Run these checks before enabling an externally backed profile or using shadow results for trading policy. Keep model influence advisory until explicit operator review of validated out-of-sample results. Start with repeatable provider conformance and paper state recovery tests in staging.
