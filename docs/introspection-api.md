# Introspection API inventory

This Phase A inventory is the approval gate. Backend snapshot [28e4fee](https://github.com/cmarin001/dex-orchestrator/commit/28e4feee048b95dcebd0ca5f515ac37182ebd8c1) includes PR #17 and Phase B batch 1 from PR #18. The [frontend adapter snapshot](https://github.com/cmarin001/dex-orchestrator-app/commit/27a4b942b8c6fdd3247ad2f8b42a5f5226d16c27) informs the reused HTTP contract. This inventory covers every tracked file in the pinned backend tree, including 108 files under `src/`. Files added by this proposal enter the next generated snapshot.

The inventory has **285 files, 285 reflection endpoints, 103 capability and compatibility endpoints, and 374 MCP mappings**. These are design counts, including existing HTTP routes. The 14 explicit MCP exceptions are covered by Table 5. No introspection endpoints or MCP changes ship with this inventory.

## Contract decisions for review

- Reflection resolves tracked canonical paths through a generated manifest. It supplies static exports, signatures, imports, reverse dependency edges, source revision and registered schema/input references. Source bodies, working-tree paths, environment values and raw audit payloads are excluded. The schema registry uses reviewed schemas and public examples. Private keys, credentials, prompts and injected clients are never serialized. Match audit events through explicit operation and module tags and return an empty tail where historical events lack attribution.
- The runtime mutation boundary stays with named, schema-validated operations. Source code, prompt files, execution modules, schemas and deployment definitions are immutable through the API. Validation may run against a pinned schema. Schema changes use Git review. Runtime settings changes enter the existing worker queue.
- Invocation is explicit. Table 3 lists pure computations, pinned schema validation and bounded named market-data reads. Network wrappers use fixed destinations, canonical identifiers, quotas and redacted results. No arbitrary function lookup, callback injection, shell execution, file operations, raw transaction construction, signing or broadcasting. Per-strategy inspection exposes metadata and schema; existing signal and registry controls serve evaluation workflows until a bounded replay contract is reviewed.
- Write intake uses Idempotency-Key and binds it to the actor, operation and normalized parameters. New acceptance returns 202; identical replay or lookup returns 200 and the original request_id. Conflict returns 409. Dry-run validates and reports intended effects without queueing. Emergency operation may be accepted independently of health polling. The pending batch 2 decision about protective live exits remains open.
- Each mirrored operation uses the REST validation and application service. Default MCP exposure contains zero mutations. Every command tool remains absent until individually enabled and supplied with authorization equivalent to REST step-up. The four wallet signer files and all agent prompts have REST metadata only. The loopback health probe is infrastructure-only; authenticated MCP health maps to the authenticated versioned route. The legacy live stream maps to a bounded snapshot with the same live-view item schema; the transport parity exception requires review.
- Record one append-only api-log row per REST or MCP request with timestamp, authenticated actor, surface, method, route template, allow-listed redacted parameters, status, request ID and duration. Record queued command effects separately in the trading journal. Treat unknown or pre-auth input as untrusted and omit bodies for secret-bearing routes. The read API for that log does not embed its raw output in the request log.
- GET fields, expand and verbose select public manifest fields only. Limits, cursors, time ranges, exact filters, ordering and output format are available where a documented projection supports them. An unsupported option yields a validation error. Export and detail shapes reuse the approved dashboard contract. Generate the per-endpoint docs and index alongside the runtime manifest after review.

## Table 1 — Files by module


| File ID | Path | Module | Static exports | Schema signal | Tier | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| FILE-001 | .dockerignore | root | — | No | read-only | Static metadata |
| FILE-002 | .env.example | root | — | No | read-only | Static metadata |
| FILE-003 | .github/dependabot.yml | .github | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-004 | .github/scripts/ghcr-cleanup.sh | .github | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-005 | .github/workflows/ci.yml | .github | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-006 | .github/workflows/deploy.yml | .github | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-007 | .gitignore | root | — | No | read-only | Static metadata |
| FILE-008 | .nvmrc | root | — | No | read-only | Static metadata |
| FILE-009 | LICENSE | root | — | No | read-only | Static metadata |
| FILE-010 | README.md | root | — | No | read-only | Static metadata |
| FILE-011 | config/default.json | config | — | JSON data; see validation owner | runtime-only | Typed runtime capability only; source immutable |
| FILE-012 | config/models.json | config | — | JSON data; see validation owner | runtime-only | Typed runtime capability only; source immutable |
| FILE-013 | config/providers.json | config | — | JSON data; see validation owner | runtime-only | Typed runtime capability only; source immutable |
| FILE-014 | deploy/README.md | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-015 | deploy/cicd/README.md | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-016 | deploy/cicd/addresses.json | deploy | — | JSON data; see validation owner | read-only | Deployment inventory; release changes through Git |
| FILE-017 | deploy/cicd/deploy.sh | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-018 | deploy/cicd/dex-deploy.tmpfiles.conf | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-019 | deploy/cicd/healthcheck.sh | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-020 | deploy/cicd/install-deploy-key.sh | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-021 | deploy/cicd/lib/derive-address.mjs | deploy | kinds, derive, signerAddress | No | read-only | Deployment inventory; release changes through Git |
| FILE-022 | deploy/cicd/lib/install-derive-tools.sh | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-023 | deploy/cicd/lib/wallet-log.sh | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-024 | deploy/cicd/rollback.sh | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-025 | deploy/cicd/setup-secrets.sh | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-026 | deploy/cicd/ssh-deploy.sh | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-027 | deploy/cicd/verify-secrets.sh | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-028 | deploy/docker/.dockerignore | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-029 | deploy/docker/Dockerfile | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-030 | deploy/docker/docker-compose.dev.yml | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-031 | deploy/docker/docker-compose.yml | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-032 | deploy/fail2ban/jail.local | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-033 | deploy/nginx/dex-orchestrator.conf | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-034 | deploy/scripts/00-bootstrap.sh | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-035 | deploy/scripts/01-docker-install.sh | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-036 | deploy/scripts/02-secrets-init.sh | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-037 | deploy/scripts/03-nginx-setup.sh | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-038 | deploy/scripts/04-deploy.sh | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-039 | deploy/scripts/99-verify.sh | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-040 | deploy/scripts/common.sh | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-041 | deploy/systemd/dex-dashboard.service | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-042 | deploy/systemd/dex-mcp.service | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-043 | deploy/systemd/dex-worker.service | deploy | — | No | read-only | Deployment inventory; release changes through Git |
| FILE-044 | docs/adr/0001-runtime.md | docs | — | No | read-only | Static metadata |
| FILE-045 | docs/adr/0002-language.md | docs | — | No | read-only | Static metadata |
| FILE-046 | docs/adr/0003-gpt-and-plugin-retirement.md | docs | — | No | read-only | Static metadata |
| FILE-047 | docs/adr/0004-dashboard-and-tradeKeel-reuse.md | docs | — | No | read-only | Static metadata |
| FILE-048 | docs/adr/0005-control-plane.md | docs | — | No | read-only | Static metadata |
| FILE-049 | docs/architecture.md | docs | — | No | read-only | Static metadata |
| FILE-050 | docs/backend-requirements.md | docs | — | No | read-only | Static metadata |
| FILE-051 | docs/conformance.md | docs | — | No | read-only | Static metadata |
| FILE-052 | docs/dashboard-api.md | docs | — | No | read-only | Static metadata |
| FILE-053 | docs/dashboard-auth.md | docs | — | No | read-only | Static metadata |
| FILE-054 | docs/frontend-api-contract.md | docs | — | No | read-only | Static metadata |
| FILE-055 | docs/frontend-backend-contract.md | docs | — | No | read-only | Static metadata |
| FILE-056 | docs/frontend-non-actions.md | docs | — | No | read-only | Static metadata |
| FILE-057 | docs/hermes-integration.md | docs | — | No | read-only | Static metadata |
| FILE-058 | docs/live-runbook.md | docs | — | No | read-only | Static metadata |
| FILE-059 | docs/prompts/phase-5-cicd.md | docs | — | No | read-only | Static metadata |
| FILE-060 | docs/rollback.md | docs | — | No | read-only | Static metadata |
| FILE-061 | docs/schemas.md | docs | — | No | read-only | Static metadata |
| FILE-062 | docs/secrets-runbook.md | docs | — | No | read-only | Static metadata |
| FILE-063 | docs/strategies.md | docs | — | No | read-only | Static metadata |
| FILE-064 | fixtures/dexscreener/ethereum-weth.json | fixtures | — | JSON data; see validation owner | read-only | Test inventory; contents excluded |
| FILE-065 | fixtures/goplus/ethereum-usdc.json | fixtures | — | JSON data; see validation owner | read-only | Test inventory; contents excluded |
| FILE-066 | fixtures/honeypot-is/ethereum-usdc.json | fixtures | — | JSON data; see validation owner | read-only | Test inventory; contents excluded |
| FILE-067 | fixtures/rugcheck/solana-wsol.json | fixtures | — | JSON data; see validation owner | read-only | Test inventory; contents excluded |
| FILE-068 | health.ts | root | — | No | read-only | Static metadata |
| FILE-069 | package-lock.json | root | — | JSON data; see validation owner | read-only | Static metadata |
| FILE-070 | package.json | root | — | JSON data; see validation owner | read-only | Static metadata |
| FILE-071 | prompts/equity-curve.md | prompts | — | No | read-only | REST metadata only; no invoke, write or MCP tool |
| FILE-072 | prompts/executor.md | prompts | — | No | read-only | REST metadata only; no invoke, write or MCP tool |
| FILE-073 | prompts/logger.md | prompts | — | No | read-only | REST metadata only; no invoke, write or MCP tool |
| FILE-074 | prompts/recon-a-market-intel.md | prompts | — | No | read-only | REST metadata only; no invoke, write or MCP tool |
| FILE-075 | prompts/recon-b-onchain.md | prompts | — | No | read-only | REST metadata only; no invoke, write or MCP tool |
| FILE-076 | prompts/recon-c-social.md | prompts | — | No | read-only | REST metadata only; no invoke, write or MCP tool |
| FILE-077 | prompts/rug-check.md | prompts | — | No | read-only | REST metadata only; no invoke, write or MCP tool |
| FILE-078 | prompts/scanner.md | prompts | — | No | read-only | REST metadata only; no invoke, write or MCP tool |
| FILE-079 | prompts/sizer.md | prompts | — | No | read-only | REST metadata only; no invoke, write or MCP tool |
| FILE-080 | public/robots.txt | public | — | No | read-only | Static metadata |
| FILE-081 | schemas/budget.ts | schemas | budgetSchema, BudgetConfig | Zod declaration | read-only | Schema metadata with typed validation |
| FILE-082 | schemas/chain-routing.ts | schemas | memecoinFilterSchema, chainRoutingSchema, ChainRouting | Zod declaration | read-only | Schema metadata with typed validation |
| FILE-083 | schemas/common.ts | schemas | chainSchema, Chain, addressMatches, normalizeAddress, identityFields, identitySchema, targetSchema, handoff, Target, Handoff, money, assessment, tradeKey | Zod declaration | read-only | Schema metadata; changes through Git |
| FILE-084 | schemas/control-plane.ts | schemas | phase3Command, Phase3Command, signalRecord, SignalRecord | Zod declaration | read-only | Schema metadata; changes through Git |
| FILE-085 | schemas/equity-curve.ts | schemas | equityCurveSchema, EquityCurveInput, equityCurveInputSchema | Zod declaration | read-only | Schema metadata; changes through Git |
| FILE-086 | schemas/executor.ts | schemas | executorSchema, ExecutorInput, executorInput | Zod declaration | read-only | Schema metadata; changes through Git |
| FILE-087 | schemas/exit-policy.ts | schemas | timeoutRungSchema, TimeoutRung, defaultLadder, ladderSchema, exitPolicySchema, ExitPolicy | Zod declaration | read-only | Schema metadata with typed validation |
| FILE-088 | schemas/live-view.ts | schemas | chartPointSchema, positionMarkSchema, liveViewSchema, ChartPoint, PositionMark, LiveView, Provenanced | Zod declaration | read-only | Schema metadata; changes through Git |
| FILE-089 | schemas/logger.ts | schemas | agentName, logEnvelope, LogHop, logRow, loggerSchema | Zod declaration | read-only | Schema metadata; changes through Git |
| FILE-090 | schemas/mode-config.ts | schemas | operatingMode, degradationMode, modeConfigSchema, ModeConfig | Zod declaration | read-only | Schema metadata with typed validation |
| FILE-091 | schemas/provider-config.ts | schemas | providerConfigSchema, providerPolicySchema, ProviderConfig, ProviderPolicy | Zod declaration | read-only | Schema metadata; changes through Git |
| FILE-092 | schemas/recon-a.ts | schemas | reconAInput, reconAMarketRow, reconASchema | Zod declaration | read-only | Schema metadata; changes through Git |
| FILE-093 | schemas/recon-b.ts | schemas | reconBInput, reconBSchema | Zod declaration | read-only | Schema metadata; changes through Git |
| FILE-094 | schemas/recon-c.ts | schemas | reconCInput, reconCSchema | Zod declaration | read-only | Schema metadata; changes through Git |
| FILE-095 | schemas/recon-checks.ts | schemas | reconChecksSchema, toRugChecks | Zod declaration | read-only | Schema metadata; changes through Git |
| FILE-096 | schemas/recon-snapshot.ts | schemas | checks, marketSnapshotSchema, securitySnapshotSchema, socialSnapshotSchema, reconSnapshotSchema, ReconSnapshot, MarketSnapshot, SecuritySnapshot | Zod declaration | read-only | Schema metadata; changes through Git |
| FILE-097 | schemas/risk-config.ts | schemas | riskConfigSchema, RiskConfig, defaultRisk, riskRevisionSchema, RiskRevision | Zod declaration | read-only | Schema metadata with typed validation |
| FILE-098 | schemas/rug-check.ts | schemas | rugCheckSchema, RugChecksRaw | Zod declaration | read-only | Schema metadata; changes through Git |
| FILE-099 | schemas/scanner.ts | schemas | scannerFeedFields, scannerRowSchema, scannerSchema, ScannerRow, scannerInputSchema, ScannerInput | Zod declaration | read-only | Schema metadata; changes through Git |
| FILE-100 | schemas/signal.ts | schemas | signalSchema, Signal | Zod declaration | read-only | Schema metadata; changes through Git |
| FILE-101 | schemas/sizer.ts | schemas | sizerSchema, sizerInputSchema, SizerInput | Zod declaration | read-only | Schema metadata; changes through Git |
| FILE-102 | schemas/strategy.ts | schemas | consensusSchema, aggregatorSchema, strategySetting | Zod declaration | read-only | Schema metadata; changes through Git |
| FILE-103 | schemas/trade-history.ts | schemas | exitReasonSchema, paperCloseSchema, tradeHistorySchema, TradeHistoryRow, PaperClose | Zod declaration | read-only | Schema metadata; changes through Git |
| FILE-104 | schemas/transaction-intent.ts | schemas | walletChainSchema, positiveUnits, routeHintSchema, transactionIntentSchema, TransactionIntent, WalletChain | Zod declaration | read-only | Schema metadata; changes through Git |
| FILE-105 | schemas/tx-result.ts | schemas | simulationResultSchema, txReceiptSchema, TxReceipt, SimulationResult, txResultSchema, TxResult | Zod declaration | read-only | Schema metadata; changes through Git |
| FILE-106 | schemas/wallet-config.ts | schemas | walletConfigSchema, WalletConfig | Zod declaration | read-only | Schema metadata; changes through Git |
| FILE-107 | src/agents/call.ts | agents | Tool, AgentRequest, CallAgent, responsesAgent, matchesIdentity | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-108 | src/agents/equity-curve.ts | agents | equityCurve | No | runtime-only | Typed runtime capability only; source immutable |
| FILE-109 | src/agents/executor.ts | agents | executor, signApprovedTransaction | No | runtime-only | Typed runtime capability only; source immutable |
| FILE-110 | src/agents/logger.ts | agents | logger | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-111 | src/agents/recon-a.ts | agents | reconA | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-112 | src/agents/recon-b.ts | agents | reconB | No | runtime-only | Typed runtime capability only; source immutable |
| FILE-113 | src/agents/recon-c.ts | agents | reconC | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-114 | src/agents/rug-check.ts | agents | rugInput, rugCheck, RugCheckPass, requireRugCheckPass | No | runtime-only | Typed runtime capability only; source immutable |
| FILE-115 | src/agents/scanner.ts | agents | scanner | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-116 | src/agents/sizer.ts | agents | riskBudget, sizer | No | runtime-only | Typed runtime capability only; source immutable |
| FILE-117 | src/cache/merge.ts | cache | NEW_TTL_MS, WATCHED_TTL_MS, targetKey, reconKey, merge, Merged | No | read-only | Static metadata |
| FILE-118 | src/cache/recon-cache.ts | cache | ReconCache | No | runtime-only | Typed runtime capability only; source immutable |
| FILE-119 | src/cache/ttl.ts | cache | Timed, isFresh, TtlCache | No | runtime-only | Typed runtime capability only; source immutable |
| FILE-120 | src/chain/router.ts | chain | allocation, memecoinEligible | No | runtime-only | Typed runtime capability only; source immutable |
| FILE-121 | src/config/secrets.ts | config | secretPlaceholder, withSecret, secretText | No | read-only | Restricted metadata; exclude secret values and execution inputs |
| FILE-122 | src/control/commands.ts | control | empty, requestKey, toggle, liveExecutionInput, riskInput, rejectInput, exitInput, commandSchema, Command, ControlConflict, Inbox | Zod declaration | read-only | Static metadata |
| FILE-123 | src/control/config-journals.ts | control | ConfigJournals | No | read-only | Static metadata |
| FILE-124 | src/control/phase3.ts | control | input, reads, changes, Change, createPhase3Api | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-125 | src/control/plane.ts | control | ControlPlane | No | read-only | Static metadata |
| FILE-126 | src/control/service.ts | control | auditQuery, controlInputs, createControl, ControlService | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-127 | src/control/worker.ts | control | WorkerControls | No | read-only | Static metadata |
| FILE-128 | src/dashboard-api/auth.ts | dashboard-api | isAuthorized, DashboardAuthEnv, dashboardAccess | No | read-only | Restricted metadata; exclude secret values and execution inputs |
| FILE-129 | src/dashboard-api/jwt.ts | dashboard-api | readScope, writeScope, sensitiveScope, DashboardIdentity, JwtConfig, dashboardJwt, dashboardAuthMode | Zod declaration | read-only | Restricted metadata; exclude secret values and execution inputs |
| FILE-130 | src/dashboard-api/routes.ts | dashboard-api | dashboardRoutes, createDashboardApi | Zod declaration | read-only | Static metadata |
| FILE-131 | src/dashboard-api/server.ts | dashboard-api | — | No | read-only | Static metadata |
| FILE-132 | src/dashboard-api/wallets.ts | dashboard-api | walletOverview | Zod declaration | read-only | Static metadata |
| FILE-133 | src/exec/sidecar-client.ts | exec | requestSidecarSignature | Zod declaration | read-only | Restricted metadata; exclude secret values and execution inputs |
| FILE-134 | src/exec/signer.ts | exec | SigningRequest, signTransaction | No | read-only | Restricted metadata; exclude secret values and execution inputs |
| FILE-135 | src/exits/policy.ts | exits | activeTarget, canExit | No | runtime-only | Typed runtime capability only; source immutable |
| FILE-136 | src/exits/watcher.ts | exits | watchPositions | No | runtime-only | Typed runtime capability only; source immutable |
| FILE-137 | src/index.ts | src | — | Zod declaration | read-only | Static metadata |
| FILE-138 | src/live/publisher.ts | live | liveViews | No | runtime-only | Typed runtime capability only; source immutable |
| FILE-139 | src/live/types.ts | live | ChartPoint, LiveView, PositionMark, Provenanced | No | read-only | Static metadata |
| FILE-140 | src/logging/logger.ts | logging | Audit, fileAudit, readJournal, replayPositions | No | read-only | Static metadata |
| FILE-141 | src/logging/operational.ts | logging | withLogContext, failureKind, startTimer, elapsed, log, observe, logHttp | No | read-only | Static metadata |
| FILE-142 | src/logging/projections/trade-history.ts | logging | projectTradeHistory | No | read-only | Static metadata |
| FILE-143 | src/logging/types.ts | logging | auditSchema, JournalEvent, AuditEvent, isFill, isClose | Zod declaration | read-only | Static metadata |
| FILE-144 | src/mcp/http.ts | mcp | createMcpHttp | No | read-only | Static metadata |
| FILE-145 | src/mcp/server.ts | mcp | — | No | read-only | Static metadata |
| FILE-146 | src/mcp/tools.ts | mcp | createMcp | No | read-only | Static metadata |
| FILE-147 | src/mode/config.ts | mode | initialSettings, Settings, applySetting | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-148 | src/mode/local-agent.ts | mode | localAgent | No | read-only | Static metadata |
| FILE-149 | src/mode/runtime.ts | mode | ModeRuntime | No | runtime-only | Typed runtime capability only; source immutable |
| FILE-150 | src/mode/switch.ts | mode | transition | No | read-only | Static metadata |
| FILE-151 | src/orchestrator/deployment.ts | orchestrator | deploymentGate | No | read-only | Static metadata |
| FILE-152 | src/orchestrator/errors.ts | orchestrator | CandidateError, SystemError | No | read-only | Static metadata |
| FILE-153 | src/orchestrator/loop.ts | orchestrator | LoopOptions, runLoop | No | runtime-only | Typed runtime capability only; source immutable |
| FILE-154 | src/orchestrator/pipeline.ts | orchestrator | scannerLimits, Pipeline, runCandidate | No | read-only | Static metadata |
| FILE-155 | src/orchestrator/recon-refresh.ts | orchestrator | refreshRecon | No | runtime-only | Typed runtime capability only; source immutable |
| FILE-156 | src/providers/adapter.ts | providers | serialize, OpenAICompatProvider | Zod declaration | read-only | Static metadata |
| FILE-157 | src/providers/agent.ts | providers | providerAgent | Zod declaration | read-only | Static metadata |
| FILE-158 | src/providers/budget.ts | providers | Budget | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-159 | src/providers/cache.ts | providers | ResponseCache | No | read-only | Static metadata |
| FILE-160 | src/providers/router.ts | providers | Router | No | runtime-only | Typed runtime capability only; source immutable |
| FILE-161 | src/providers/types.ts | providers | ToolCall, CompletionRequest, CompletionResponse, ModelProvider, ProviderFailure, ProviderError, AllProvidersDownError, BudgetExhaustedError | No | read-only | Static metadata |
| FILE-162 | src/state/equity.ts | state | sizePosition, Equity | No | runtime-only | Typed runtime capability only; source immutable |
| FILE-163 | src/state/positions.ts | state | positionSchema, Position, Positions | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-164 | src/state/risk-config.ts | state | readRisk, appendRisk, requireFreshRisk | No | runtime-only | Typed runtime capability only; source immutable |
| FILE-165 | src/strategies/aggregator.ts | strategies | aggregate | No | read-only | Static metadata |
| FILE-166 | src/strategies/builtin/anti-signal.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-167 | src/strategies/builtin/breakout-15m.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-168 | src/strategies/builtin/btc-correlation.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-169 | src/strategies/builtin/copy-trade.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-170 | src/strategies/builtin/dip-buy.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-171 | src/strategies/builtin/gas-aware.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-172 | src/strategies/builtin/holder-conc-drop.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-173 | src/strategies/builtin/holder-growth.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-174 | src/strategies/builtin/honeypot-recheck.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-175 | src/strategies/builtin/kelly-fraction.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-176 | src/strategies/builtin/liq-drain-exit.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-177 | src/strategies/builtin/liquidity-influx.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-178 | src/strategies/builtin/mean-revert-1h.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-179 | src/strategies/builtin/momentum-ladder.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-180 | src/strategies/builtin/multi-signal-consensus.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-181 | src/strategies/builtin/new-pair-momentum.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-182 | src/strategies/builtin/new-pool-snipe.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-183 | src/strategies/builtin/range-breakout.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-184 | src/strategies/builtin/rsi-oversold-5m.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-185 | src/strategies/builtin/session-aware.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-186 | src/strategies/builtin/time-of-day.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-187 | src/strategies/builtin/vol-mcap-ratio.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-188 | src/strategies/builtin/volume-spike.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-189 | src/strategies/builtin/whale-accum.ts | strategies | default | Zod declaration | runtime-only | Typed runtime capability only; source immutable |
| FILE-190 | src/strategies/builtins.ts | strategies | builtins | No | read-only | Static metadata |
| FILE-191 | src/strategies/evidence.ts | strategies | StrategyEvidence | Zod declaration | read-only | Static metadata |
| FILE-192 | src/strategies/registry.ts | strategies | Registry | No | runtime-only | Typed runtime capability only; source immutable |
| FILE-193 | src/strategies/strategy.ts | strategies | Observation, StrategyContext, Strategy, signal, guard, overlay, window, baseline, mean, avgVol, holdingVolume, rsi, correlation | No | read-only | Static metadata |
| FILE-194 | src/tools/dexscreener.ts | tools | Fetch, getJson, dexScreener | Zod declaration | read-only | Static metadata |
| FILE-195 | src/tools/discovery.ts | tools | scopeSchema, DiscoveryScope, geckoterminalPoolsByDex, discover | Zod declaration | read-only | Static metadata |
| FILE-196 | src/tools/geckoterminal.ts | tools | geckoTerminal | Zod declaration | read-only | Static metadata |
| FILE-197 | src/tools/goplus.ts | tools | evmChainIds, Finding, goPlus | Zod declaration | read-only | Static metadata |
| FILE-198 | src/tools/honeypot-is.ts | tools | honeypotIs | Zod declaration | read-only | Static metadata |
| FILE-199 | src/tools/recon-action.ts | tools | reconAction | Zod declaration | read-only | Static metadata |
| FILE-200 | src/tools/recon-evidence.ts | tools | securityEvidence, poolEvidence | Zod declaration | read-only | Static metadata |
| FILE-201 | src/tools/rugcheck-xyz.ts | tools | rugCheckXyz | Zod declaration | read-only | Static metadata |
| FILE-202 | src/tools/social.ts | tools | socialActions | Zod declaration | read-only | Static metadata |
| FILE-203 | src/wallet/broadcast.ts | wallet | broadcastSigned | No | read-only | Restricted metadata; exclude secret values and execution inputs |
| FILE-204 | src/wallet/config.ts | wallet | usdCents, configuredWallet | Zod declaration | read-only | Restricted metadata; exclude secret values and execution inputs |
| FILE-205 | src/wallet/confirm.ts | wallet | confirm | No | runtime-only | Typed runtime capability only; source immutable |
| FILE-206 | src/wallet/key-source.ts | wallet | EvmKey, evmKey, solanaKey, bitcoinKey | No | read-only | Restricted metadata; exclude secret values and execution inputs |
| FILE-207 | src/wallet/limits.ts | wallet | reserveSpend | No | runtime-only | Typed runtime capability only; source immutable |
| FILE-208 | src/wallet/live.ts | wallet | createLiveExecution, LiveExecution | Zod declaration | read-only | Restricted metadata; exclude secret values and execution inputs |
| FILE-209 | src/wallet/signer.ts | wallet | Signer, ChainAdapter, createSigner | Zod declaration | read-only | REST metadata only; no invoke, write or MCP tool |
| FILE-210 | src/wallet/signers/bitcoin.ts | wallet | bitcoinAdapter | Zod declaration | read-only | REST metadata only; no invoke, write or MCP tool |
| FILE-211 | src/wallet/signers/evm.ts | wallet | networks, allowanceHolder, allowanceAbi, settlerAbi, evmAdapter | Zod declaration | read-only | REST metadata only; no invoke, write or MCP tool |
| FILE-212 | src/wallet/signers/solana.ts | wallet | ataProgram, splTokenProgram, associatedAccount, solanaAdapter | Zod declaration | read-only | REST metadata only; no invoke, write or MCP tool |
| FILE-213 | src/wallet/simulate.ts | wallet | requireSimulation | No | read-only | Static metadata |
| FILE-214 | src/wallet/types.ts | wallet | TransactionIntent, WalletChain, TxReceipt, TxResult, SimulationResult, SignedTx | No | read-only | Static metadata |
| FILE-215 | tests/agent-fixture.ts | tests | now, id, feed, scan, raw, checks, rug, limits, sizing, portfolio, fill, provenance, security, market, mockApi, pinnedPrompt, geckoResponse, securityProvider | No | read-only | Test inventory; contents excluded |
| FILE-216 | tests/control-fixture.ts | tests | target, identity, config, controlFixture | No | read-only | Test inventory; contents excluded |
| FILE-217 | tests/deploy-cicd.sh | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-218 | tests/integration/agent-contracts.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-219 | tests/integration/ai-mode.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-220 | tests/integration/budget-degrade.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-221 | tests/integration/chain-switch.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-222 | tests/integration/control-api.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-223 | tests/integration/dashboard-api-auth.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-224 | tests/integration/dashboard-jwt.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-225 | tests/integration/deploy-health.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-226 | tests/integration/live-intent-e2e.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-227 | tests/integration/live-view.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-228 | tests/integration/mcp.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-229 | tests/integration/mode-switch-mid-cycle.test.ts | tests | — | Zod declaration | read-only | Test inventory; contents excluded |
| FILE-230 | tests/integration/phase3-controls.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-231 | tests/integration/pipeline-smoke.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-232 | tests/integration/provider-failover.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-233 | tests/integration/recon-b-with-fixtures.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-234 | tests/integration/simulation.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-235 | tests/integration/strategies-only.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-236 | tests/integration/wallet-overview.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-237 | tests/phase3-fixture.ts | tests | observation, context, req, provider, fixture | No | read-only | Test inventory; contents excluded |
| FILE-238 | tests/phase3-market-preload.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-239 | tests/unit/aggregator-monotonic.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-240 | tests/unit/budget-exhaust.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-241 | tests/unit/chain-router.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-242 | tests/unit/controls.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-243 | tests/unit/deploy-scripts.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-244 | tests/unit/deployment.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-245 | tests/unit/derive-address.test.mjs | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-246 | tests/unit/equity-curve.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-247 | tests/unit/executor.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-248 | tests/unit/exit-policy-profit-only.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-249 | tests/unit/key-source-file.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-250 | tests/unit/key-source.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-251 | tests/unit/limits.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-252 | tests/unit/logger.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-253 | tests/unit/memecoin-filter.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-254 | tests/unit/merge.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-255 | tests/unit/mode-switch.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-256 | tests/unit/model-tiering.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-257 | tests/unit/operational-logging.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-258 | tests/unit/prompt-prefix-stable.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-259 | tests/unit/provider-adapter.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-260 | tests/unit/recon-a-scope.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-261 | tests/unit/recon-a.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-262 | tests/unit/recon-b-handoff.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-263 | tests/unit/recon-b.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-264 | tests/unit/recon-c.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-265 | tests/unit/response-cache.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-266 | tests/unit/risk-config-journal.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-267 | tests/unit/router-cost-first.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-268 | tests/unit/router-fallback.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-269 | tests/unit/rug-check.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-270 | tests/unit/scanner.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-271 | tests/unit/schema-validation.test.ts | tests | — | Zod declaration | read-only | Test inventory; contents excluded |
| FILE-272 | tests/unit/signer-bitcoin.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-273 | tests/unit/signer-evm.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-274 | tests/unit/signer-solana.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-275 | tests/unit/sizer.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-276 | tests/unit/sizing-math.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-277 | tests/unit/strategy-aggregator.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-278 | tests/unit/strategy-determinism.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-279 | tests/unit/strategy-registry.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-280 | tests/unit/timeout-ladder.test.ts | tests | policy | No | read-only | Test inventory; contents excluded |
| FILE-281 | tests/unit/trade-history-projection.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-282 | tests/unit/ttl.test.ts | tests | — | No | read-only | Test inventory; contents excluded |
| FILE-283 | tests/wallet-fixture.ts | tests | caps, intent, noWait, walletFixture | No | read-only | Test inventory; contents excluded |
| FILE-284 | tsconfig.build.json | root | — | JSON data; see validation owner | read-only | Static metadata |
| FILE-285 | tsconfig.json | root | — | JSON data; see validation owner | read-only | Static metadata |

## Table 2 — Reflection endpoints

All rows use authenticated GET and return the FileReflection shape with nullable unavailable metadata. Every route below is proposed.

| Reflection ID | File ID | Path | Access |
| --- | --- | --- | --- |
| REF-001 | FILE-001 | /api/v1/introspect/root/.dockerignore | Read-only operator |
| REF-002 | FILE-002 | /api/v1/introspect/root/.env.example | Read-only operator |
| REF-003 | FILE-003 | /api/v1/introspect/.github/dependabot.yml | Read-only operator |
| REF-004 | FILE-004 | /api/v1/introspect/.github/scripts/ghcr-cleanup.sh | Read-only operator |
| REF-005 | FILE-005 | /api/v1/introspect/.github/workflows/ci.yml | Read-only operator |
| REF-006 | FILE-006 | /api/v1/introspect/.github/workflows/deploy.yml | Read-only operator |
| REF-007 | FILE-007 | /api/v1/introspect/root/.gitignore | Read-only operator |
| REF-008 | FILE-008 | /api/v1/introspect/root/.nvmrc | Read-only operator |
| REF-009 | FILE-009 | /api/v1/introspect/root/LICENSE | Read-only operator |
| REF-010 | FILE-010 | /api/v1/introspect/root/README.md | Read-only operator |
| REF-011 | FILE-011 | /api/v1/introspect/config/default.json | Read-only operator |
| REF-012 | FILE-012 | /api/v1/introspect/config/models.json | Read-only operator |
| REF-013 | FILE-013 | /api/v1/introspect/config/providers.json | Read-only operator |
| REF-014 | FILE-014 | /api/v1/introspect/deploy/README.md | Read-only operator |
| REF-015 | FILE-015 | /api/v1/introspect/deploy/cicd/README.md | Read-only operator |
| REF-016 | FILE-016 | /api/v1/introspect/deploy/cicd/addresses.json | Read-only operator |
| REF-017 | FILE-017 | /api/v1/introspect/deploy/cicd/deploy.sh | Read-only operator |
| REF-018 | FILE-018 | /api/v1/introspect/deploy/cicd/dex-deploy.tmpfiles.conf | Read-only operator |
| REF-019 | FILE-019 | /api/v1/introspect/deploy/cicd/healthcheck.sh | Read-only operator |
| REF-020 | FILE-020 | /api/v1/introspect/deploy/cicd/install-deploy-key.sh | Read-only operator |
| REF-021 | FILE-021 | /api/v1/introspect/deploy/cicd/lib/derive-address.mjs | Read-only operator |
| REF-022 | FILE-022 | /api/v1/introspect/deploy/cicd/lib/install-derive-tools.sh | Read-only operator |
| REF-023 | FILE-023 | /api/v1/introspect/deploy/cicd/lib/wallet-log.sh | Read-only operator |
| REF-024 | FILE-024 | /api/v1/introspect/deploy/cicd/rollback.sh | Read-only operator |
| REF-025 | FILE-025 | /api/v1/introspect/deploy/cicd/setup-secrets.sh | Read-only operator |
| REF-026 | FILE-026 | /api/v1/introspect/deploy/cicd/ssh-deploy.sh | Read-only operator |
| REF-027 | FILE-027 | /api/v1/introspect/deploy/cicd/verify-secrets.sh | Read-only operator |
| REF-028 | FILE-028 | /api/v1/introspect/deploy/docker/.dockerignore | Read-only operator |
| REF-029 | FILE-029 | /api/v1/introspect/deploy/docker/Dockerfile | Read-only operator |
| REF-030 | FILE-030 | /api/v1/introspect/deploy/docker/docker-compose.dev.yml | Read-only operator |
| REF-031 | FILE-031 | /api/v1/introspect/deploy/docker/docker-compose.yml | Read-only operator |
| REF-032 | FILE-032 | /api/v1/introspect/deploy/fail2ban/jail.local | Read-only operator |
| REF-033 | FILE-033 | /api/v1/introspect/deploy/nginx/dex-orchestrator.conf | Read-only operator |
| REF-034 | FILE-034 | /api/v1/introspect/deploy/scripts/00-bootstrap.sh | Read-only operator |
| REF-035 | FILE-035 | /api/v1/introspect/deploy/scripts/01-docker-install.sh | Read-only operator |
| REF-036 | FILE-036 | /api/v1/introspect/deploy/scripts/02-secrets-init.sh | Read-only operator |
| REF-037 | FILE-037 | /api/v1/introspect/deploy/scripts/03-nginx-setup.sh | Read-only operator |
| REF-038 | FILE-038 | /api/v1/introspect/deploy/scripts/04-deploy.sh | Read-only operator |
| REF-039 | FILE-039 | /api/v1/introspect/deploy/scripts/99-verify.sh | Read-only operator |
| REF-040 | FILE-040 | /api/v1/introspect/deploy/scripts/common.sh | Read-only operator |
| REF-041 | FILE-041 | /api/v1/introspect/deploy/systemd/dex-dashboard.service | Read-only operator |
| REF-042 | FILE-042 | /api/v1/introspect/deploy/systemd/dex-mcp.service | Read-only operator |
| REF-043 | FILE-043 | /api/v1/introspect/deploy/systemd/dex-worker.service | Read-only operator |
| REF-044 | FILE-044 | /api/v1/introspect/docs/adr/0001-runtime.md | Read-only operator |
| REF-045 | FILE-045 | /api/v1/introspect/docs/adr/0002-language.md | Read-only operator |
| REF-046 | FILE-046 | /api/v1/introspect/docs/adr/0003-gpt-and-plugin-retirement.md | Read-only operator |
| REF-047 | FILE-047 | /api/v1/introspect/docs/adr/0004-dashboard-and-tradeKeel-reuse.md | Read-only operator |
| REF-048 | FILE-048 | /api/v1/introspect/docs/adr/0005-control-plane.md | Read-only operator |
| REF-049 | FILE-049 | /api/v1/introspect/docs/architecture.md | Read-only operator |
| REF-050 | FILE-050 | /api/v1/introspect/docs/backend-requirements.md | Read-only operator |
| REF-051 | FILE-051 | /api/v1/introspect/docs/conformance.md | Read-only operator |
| REF-052 | FILE-052 | /api/v1/introspect/docs/dashboard-api.md | Read-only operator |
| REF-053 | FILE-053 | /api/v1/introspect/docs/dashboard-auth.md | Read-only operator |
| REF-054 | FILE-054 | /api/v1/introspect/docs/frontend-api-contract.md | Read-only operator |
| REF-055 | FILE-055 | /api/v1/introspect/docs/frontend-backend-contract.md | Read-only operator |
| REF-056 | FILE-056 | /api/v1/introspect/docs/frontend-non-actions.md | Read-only operator |
| REF-057 | FILE-057 | /api/v1/introspect/docs/hermes-integration.md | Read-only operator |
| REF-058 | FILE-058 | /api/v1/introspect/docs/live-runbook.md | Read-only operator |
| REF-059 | FILE-059 | /api/v1/introspect/docs/prompts/phase-5-cicd.md | Read-only operator |
| REF-060 | FILE-060 | /api/v1/introspect/docs/rollback.md | Read-only operator |
| REF-061 | FILE-061 | /api/v1/introspect/docs/schemas.md | Read-only operator |
| REF-062 | FILE-062 | /api/v1/introspect/docs/secrets-runbook.md | Read-only operator |
| REF-063 | FILE-063 | /api/v1/introspect/docs/strategies.md | Read-only operator |
| REF-064 | FILE-064 | /api/v1/introspect/fixtures/dexscreener/ethereum-weth.json | Read-only operator |
| REF-065 | FILE-065 | /api/v1/introspect/fixtures/goplus/ethereum-usdc.json | Read-only operator |
| REF-066 | FILE-066 | /api/v1/introspect/fixtures/honeypot-is/ethereum-usdc.json | Read-only operator |
| REF-067 | FILE-067 | /api/v1/introspect/fixtures/rugcheck/solana-wsol.json | Read-only operator |
| REF-068 | FILE-068 | /api/v1/introspect/root/health.ts | Read-only operator |
| REF-069 | FILE-069 | /api/v1/introspect/root/package-lock.json | Read-only operator |
| REF-070 | FILE-070 | /api/v1/introspect/root/package.json | Read-only operator |
| REF-071 | FILE-071 | /api/v1/introspect/prompts/equity-curve.md | Read-only operator; REST only |
| REF-072 | FILE-072 | /api/v1/introspect/prompts/executor.md | Read-only operator; REST only |
| REF-073 | FILE-073 | /api/v1/introspect/prompts/logger.md | Read-only operator; REST only |
| REF-074 | FILE-074 | /api/v1/introspect/prompts/recon-a-market-intel.md | Read-only operator; REST only |
| REF-075 | FILE-075 | /api/v1/introspect/prompts/recon-b-onchain.md | Read-only operator; REST only |
| REF-076 | FILE-076 | /api/v1/introspect/prompts/recon-c-social.md | Read-only operator; REST only |
| REF-077 | FILE-077 | /api/v1/introspect/prompts/rug-check.md | Read-only operator; REST only |
| REF-078 | FILE-078 | /api/v1/introspect/prompts/scanner.md | Read-only operator; REST only |
| REF-079 | FILE-079 | /api/v1/introspect/prompts/sizer.md | Read-only operator; REST only |
| REF-080 | FILE-080 | /api/v1/introspect/public/robots.txt | Read-only operator |
| REF-081 | FILE-081 | /api/v1/introspect/schemas/budget.ts | Read-only operator |
| REF-082 | FILE-082 | /api/v1/introspect/schemas/chain-routing.ts | Read-only operator |
| REF-083 | FILE-083 | /api/v1/introspect/schemas/common.ts | Read-only operator |
| REF-084 | FILE-084 | /api/v1/introspect/schemas/control-plane.ts | Read-only operator |
| REF-085 | FILE-085 | /api/v1/introspect/schemas/equity-curve.ts | Read-only operator |
| REF-086 | FILE-086 | /api/v1/introspect/schemas/executor.ts | Read-only operator |
| REF-087 | FILE-087 | /api/v1/introspect/schemas/exit-policy.ts | Read-only operator |
| REF-088 | FILE-088 | /api/v1/introspect/schemas/live-view.ts | Read-only operator |
| REF-089 | FILE-089 | /api/v1/introspect/schemas/logger.ts | Read-only operator |
| REF-090 | FILE-090 | /api/v1/introspect/schemas/mode-config.ts | Read-only operator |
| REF-091 | FILE-091 | /api/v1/introspect/schemas/provider-config.ts | Read-only operator |
| REF-092 | FILE-092 | /api/v1/introspect/schemas/recon-a.ts | Read-only operator |
| REF-093 | FILE-093 | /api/v1/introspect/schemas/recon-b.ts | Read-only operator |
| REF-094 | FILE-094 | /api/v1/introspect/schemas/recon-c.ts | Read-only operator |
| REF-095 | FILE-095 | /api/v1/introspect/schemas/recon-checks.ts | Read-only operator |
| REF-096 | FILE-096 | /api/v1/introspect/schemas/recon-snapshot.ts | Read-only operator |
| REF-097 | FILE-097 | /api/v1/introspect/schemas/risk-config.ts | Read-only operator |
| REF-098 | FILE-098 | /api/v1/introspect/schemas/rug-check.ts | Read-only operator |
| REF-099 | FILE-099 | /api/v1/introspect/schemas/scanner.ts | Read-only operator |
| REF-100 | FILE-100 | /api/v1/introspect/schemas/signal.ts | Read-only operator |
| REF-101 | FILE-101 | /api/v1/introspect/schemas/sizer.ts | Read-only operator |
| REF-102 | FILE-102 | /api/v1/introspect/schemas/strategy.ts | Read-only operator |
| REF-103 | FILE-103 | /api/v1/introspect/schemas/trade-history.ts | Read-only operator |
| REF-104 | FILE-104 | /api/v1/introspect/schemas/transaction-intent.ts | Read-only operator |
| REF-105 | FILE-105 | /api/v1/introspect/schemas/tx-result.ts | Read-only operator |
| REF-106 | FILE-106 | /api/v1/introspect/schemas/wallet-config.ts | Read-only operator |
| REF-107 | FILE-107 | /api/v1/introspect/agents/call.ts | Read-only operator |
| REF-108 | FILE-108 | /api/v1/introspect/agents/equity-curve.ts | Read-only operator |
| REF-109 | FILE-109 | /api/v1/introspect/agents/executor.ts | Read-only operator |
| REF-110 | FILE-110 | /api/v1/introspect/agents/logger.ts | Read-only operator |
| REF-111 | FILE-111 | /api/v1/introspect/agents/recon-a.ts | Read-only operator |
| REF-112 | FILE-112 | /api/v1/introspect/agents/recon-b.ts | Read-only operator |
| REF-113 | FILE-113 | /api/v1/introspect/agents/recon-c.ts | Read-only operator |
| REF-114 | FILE-114 | /api/v1/introspect/agents/rug-check.ts | Read-only operator |
| REF-115 | FILE-115 | /api/v1/introspect/agents/scanner.ts | Read-only operator |
| REF-116 | FILE-116 | /api/v1/introspect/agents/sizer.ts | Read-only operator |
| REF-117 | FILE-117 | /api/v1/introspect/cache/merge.ts | Read-only operator |
| REF-118 | FILE-118 | /api/v1/introspect/cache/recon-cache.ts | Read-only operator |
| REF-119 | FILE-119 | /api/v1/introspect/cache/ttl.ts | Read-only operator |
| REF-120 | FILE-120 | /api/v1/introspect/chain/router.ts | Read-only operator |
| REF-121 | FILE-121 | /api/v1/introspect/config/secrets.ts | Read-only operator |
| REF-122 | FILE-122 | /api/v1/introspect/control/commands.ts | Read-only operator |
| REF-123 | FILE-123 | /api/v1/introspect/control/config-journals.ts | Read-only operator |
| REF-124 | FILE-124 | /api/v1/introspect/control/phase3.ts | Read-only operator |
| REF-125 | FILE-125 | /api/v1/introspect/control/plane.ts | Read-only operator |
| REF-126 | FILE-126 | /api/v1/introspect/control/service.ts | Read-only operator |
| REF-127 | FILE-127 | /api/v1/introspect/control/worker.ts | Read-only operator |
| REF-128 | FILE-128 | /api/v1/introspect/dashboard-api/auth.ts | Read-only operator |
| REF-129 | FILE-129 | /api/v1/introspect/dashboard-api/jwt.ts | Read-only operator |
| REF-130 | FILE-130 | /api/v1/introspect/dashboard-api/routes.ts | Read-only operator |
| REF-131 | FILE-131 | /api/v1/introspect/dashboard-api/server.ts | Read-only operator |
| REF-132 | FILE-132 | /api/v1/introspect/dashboard-api/wallets.ts | Read-only operator |
| REF-133 | FILE-133 | /api/v1/introspect/exec/sidecar-client.ts | Read-only operator |
| REF-134 | FILE-134 | /api/v1/introspect/exec/signer.ts | Read-only operator |
| REF-135 | FILE-135 | /api/v1/introspect/exits/policy.ts | Read-only operator |
| REF-136 | FILE-136 | /api/v1/introspect/exits/watcher.ts | Read-only operator |
| REF-137 | FILE-137 | /api/v1/introspect/src/index.ts | Read-only operator |
| REF-138 | FILE-138 | /api/v1/introspect/live/publisher.ts | Read-only operator |
| REF-139 | FILE-139 | /api/v1/introspect/live/types.ts | Read-only operator |
| REF-140 | FILE-140 | /api/v1/introspect/logging/logger.ts | Read-only operator |
| REF-141 | FILE-141 | /api/v1/introspect/logging/operational.ts | Read-only operator |
| REF-142 | FILE-142 | /api/v1/introspect/logging/projections/trade-history.ts | Read-only operator |
| REF-143 | FILE-143 | /api/v1/introspect/logging/types.ts | Read-only operator |
| REF-144 | FILE-144 | /api/v1/introspect/mcp/http.ts | Read-only operator |
| REF-145 | FILE-145 | /api/v1/introspect/mcp/server.ts | Read-only operator |
| REF-146 | FILE-146 | /api/v1/introspect/mcp/tools.ts | Read-only operator |
| REF-147 | FILE-147 | /api/v1/introspect/mode/config.ts | Read-only operator |
| REF-148 | FILE-148 | /api/v1/introspect/mode/local-agent.ts | Read-only operator |
| REF-149 | FILE-149 | /api/v1/introspect/mode/runtime.ts | Read-only operator |
| REF-150 | FILE-150 | /api/v1/introspect/mode/switch.ts | Read-only operator |
| REF-151 | FILE-151 | /api/v1/introspect/orchestrator/deployment.ts | Read-only operator |
| REF-152 | FILE-152 | /api/v1/introspect/orchestrator/errors.ts | Read-only operator |
| REF-153 | FILE-153 | /api/v1/introspect/orchestrator/loop.ts | Read-only operator |
| REF-154 | FILE-154 | /api/v1/introspect/orchestrator/pipeline.ts | Read-only operator |
| REF-155 | FILE-155 | /api/v1/introspect/orchestrator/recon-refresh.ts | Read-only operator |
| REF-156 | FILE-156 | /api/v1/introspect/providers/adapter.ts | Read-only operator |
| REF-157 | FILE-157 | /api/v1/introspect/providers/agent.ts | Read-only operator |
| REF-158 | FILE-158 | /api/v1/introspect/providers/budget.ts | Read-only operator |
| REF-159 | FILE-159 | /api/v1/introspect/providers/cache.ts | Read-only operator |
| REF-160 | FILE-160 | /api/v1/introspect/providers/router.ts | Read-only operator |
| REF-161 | FILE-161 | /api/v1/introspect/providers/types.ts | Read-only operator |
| REF-162 | FILE-162 | /api/v1/introspect/state/equity.ts | Read-only operator |
| REF-163 | FILE-163 | /api/v1/introspect/state/positions.ts | Read-only operator |
| REF-164 | FILE-164 | /api/v1/introspect/state/risk-config.ts | Read-only operator |
| REF-165 | FILE-165 | /api/v1/introspect/strategies/aggregator.ts | Read-only operator |
| REF-166 | FILE-166 | /api/v1/introspect/strategies/builtin/anti-signal.ts | Read-only operator |
| REF-167 | FILE-167 | /api/v1/introspect/strategies/builtin/breakout-15m.ts | Read-only operator |
| REF-168 | FILE-168 | /api/v1/introspect/strategies/builtin/btc-correlation.ts | Read-only operator |
| REF-169 | FILE-169 | /api/v1/introspect/strategies/builtin/copy-trade.ts | Read-only operator |
| REF-170 | FILE-170 | /api/v1/introspect/strategies/builtin/dip-buy.ts | Read-only operator |
| REF-171 | FILE-171 | /api/v1/introspect/strategies/builtin/gas-aware.ts | Read-only operator |
| REF-172 | FILE-172 | /api/v1/introspect/strategies/builtin/holder-conc-drop.ts | Read-only operator |
| REF-173 | FILE-173 | /api/v1/introspect/strategies/builtin/holder-growth.ts | Read-only operator |
| REF-174 | FILE-174 | /api/v1/introspect/strategies/builtin/honeypot-recheck.ts | Read-only operator |
| REF-175 | FILE-175 | /api/v1/introspect/strategies/builtin/kelly-fraction.ts | Read-only operator |
| REF-176 | FILE-176 | /api/v1/introspect/strategies/builtin/liq-drain-exit.ts | Read-only operator |
| REF-177 | FILE-177 | /api/v1/introspect/strategies/builtin/liquidity-influx.ts | Read-only operator |
| REF-178 | FILE-178 | /api/v1/introspect/strategies/builtin/mean-revert-1h.ts | Read-only operator |
| REF-179 | FILE-179 | /api/v1/introspect/strategies/builtin/momentum-ladder.ts | Read-only operator |
| REF-180 | FILE-180 | /api/v1/introspect/strategies/builtin/multi-signal-consensus.ts | Read-only operator |
| REF-181 | FILE-181 | /api/v1/introspect/strategies/builtin/new-pair-momentum.ts | Read-only operator |
| REF-182 | FILE-182 | /api/v1/introspect/strategies/builtin/new-pool-snipe.ts | Read-only operator |
| REF-183 | FILE-183 | /api/v1/introspect/strategies/builtin/range-breakout.ts | Read-only operator |
| REF-184 | FILE-184 | /api/v1/introspect/strategies/builtin/rsi-oversold-5m.ts | Read-only operator |
| REF-185 | FILE-185 | /api/v1/introspect/strategies/builtin/session-aware.ts | Read-only operator |
| REF-186 | FILE-186 | /api/v1/introspect/strategies/builtin/time-of-day.ts | Read-only operator |
| REF-187 | FILE-187 | /api/v1/introspect/strategies/builtin/vol-mcap-ratio.ts | Read-only operator |
| REF-188 | FILE-188 | /api/v1/introspect/strategies/builtin/volume-spike.ts | Read-only operator |
| REF-189 | FILE-189 | /api/v1/introspect/strategies/builtin/whale-accum.ts | Read-only operator |
| REF-190 | FILE-190 | /api/v1/introspect/strategies/builtins.ts | Read-only operator |
| REF-191 | FILE-191 | /api/v1/introspect/strategies/evidence.ts | Read-only operator |
| REF-192 | FILE-192 | /api/v1/introspect/strategies/registry.ts | Read-only operator |
| REF-193 | FILE-193 | /api/v1/introspect/strategies/strategy.ts | Read-only operator |
| REF-194 | FILE-194 | /api/v1/introspect/tools/dexscreener.ts | Read-only operator |
| REF-195 | FILE-195 | /api/v1/introspect/tools/discovery.ts | Read-only operator |
| REF-196 | FILE-196 | /api/v1/introspect/tools/geckoterminal.ts | Read-only operator |
| REF-197 | FILE-197 | /api/v1/introspect/tools/goplus.ts | Read-only operator |
| REF-198 | FILE-198 | /api/v1/introspect/tools/honeypot-is.ts | Read-only operator |
| REF-199 | FILE-199 | /api/v1/introspect/tools/recon-action.ts | Read-only operator |
| REF-200 | FILE-200 | /api/v1/introspect/tools/recon-evidence.ts | Read-only operator |
| REF-201 | FILE-201 | /api/v1/introspect/tools/rugcheck-xyz.ts | Read-only operator |
| REF-202 | FILE-202 | /api/v1/introspect/tools/social.ts | Read-only operator |
| REF-203 | FILE-203 | /api/v1/introspect/wallet/broadcast.ts | Read-only operator |
| REF-204 | FILE-204 | /api/v1/introspect/wallet/config.ts | Read-only operator |
| REF-205 | FILE-205 | /api/v1/introspect/wallet/confirm.ts | Read-only operator |
| REF-206 | FILE-206 | /api/v1/introspect/wallet/key-source.ts | Read-only operator |
| REF-207 | FILE-207 | /api/v1/introspect/wallet/limits.ts | Read-only operator |
| REF-208 | FILE-208 | /api/v1/introspect/wallet/live.ts | Read-only operator |
| REF-209 | FILE-209 | /api/v1/introspect/wallet/signer.ts | Read-only operator; REST only |
| REF-210 | FILE-210 | /api/v1/introspect/wallet/signers/bitcoin.ts | Read-only operator; REST only |
| REF-211 | FILE-211 | /api/v1/introspect/wallet/signers/evm.ts | Read-only operator; REST only |
| REF-212 | FILE-212 | /api/v1/introspect/wallet/signers/solana.ts | Read-only operator; REST only |
| REF-213 | FILE-213 | /api/v1/introspect/wallet/simulate.ts | Read-only operator |
| REF-214 | FILE-214 | /api/v1/introspect/wallet/types.ts | Read-only operator |
| REF-215 | FILE-215 | /api/v1/introspect/tests/agent-fixture.ts | Read-only operator |
| REF-216 | FILE-216 | /api/v1/introspect/tests/control-fixture.ts | Read-only operator |
| REF-217 | FILE-217 | /api/v1/introspect/tests/deploy-cicd.sh | Read-only operator |
| REF-218 | FILE-218 | /api/v1/introspect/tests/integration/agent-contracts.test.ts | Read-only operator |
| REF-219 | FILE-219 | /api/v1/introspect/tests/integration/ai-mode.test.ts | Read-only operator |
| REF-220 | FILE-220 | /api/v1/introspect/tests/integration/budget-degrade.test.ts | Read-only operator |
| REF-221 | FILE-221 | /api/v1/introspect/tests/integration/chain-switch.test.ts | Read-only operator |
| REF-222 | FILE-222 | /api/v1/introspect/tests/integration/control-api.test.ts | Read-only operator |
| REF-223 | FILE-223 | /api/v1/introspect/tests/integration/dashboard-api-auth.test.ts | Read-only operator |
| REF-224 | FILE-224 | /api/v1/introspect/tests/integration/dashboard-jwt.test.ts | Read-only operator |
| REF-225 | FILE-225 | /api/v1/introspect/tests/integration/deploy-health.test.ts | Read-only operator |
| REF-226 | FILE-226 | /api/v1/introspect/tests/integration/live-intent-e2e.test.ts | Read-only operator |
| REF-227 | FILE-227 | /api/v1/introspect/tests/integration/live-view.test.ts | Read-only operator |
| REF-228 | FILE-228 | /api/v1/introspect/tests/integration/mcp.test.ts | Read-only operator |
| REF-229 | FILE-229 | /api/v1/introspect/tests/integration/mode-switch-mid-cycle.test.ts | Read-only operator |
| REF-230 | FILE-230 | /api/v1/introspect/tests/integration/phase3-controls.test.ts | Read-only operator |
| REF-231 | FILE-231 | /api/v1/introspect/tests/integration/pipeline-smoke.test.ts | Read-only operator |
| REF-232 | FILE-232 | /api/v1/introspect/tests/integration/provider-failover.test.ts | Read-only operator |
| REF-233 | FILE-233 | /api/v1/introspect/tests/integration/recon-b-with-fixtures.test.ts | Read-only operator |
| REF-234 | FILE-234 | /api/v1/introspect/tests/integration/simulation.test.ts | Read-only operator |
| REF-235 | FILE-235 | /api/v1/introspect/tests/integration/strategies-only.test.ts | Read-only operator |
| REF-236 | FILE-236 | /api/v1/introspect/tests/integration/wallet-overview.test.ts | Read-only operator |
| REF-237 | FILE-237 | /api/v1/introspect/tests/phase3-fixture.ts | Read-only operator |
| REF-238 | FILE-238 | /api/v1/introspect/tests/phase3-market-preload.ts | Read-only operator |
| REF-239 | FILE-239 | /api/v1/introspect/tests/unit/aggregator-monotonic.test.ts | Read-only operator |
| REF-240 | FILE-240 | /api/v1/introspect/tests/unit/budget-exhaust.test.ts | Read-only operator |
| REF-241 | FILE-241 | /api/v1/introspect/tests/unit/chain-router.test.ts | Read-only operator |
| REF-242 | FILE-242 | /api/v1/introspect/tests/unit/controls.test.ts | Read-only operator |
| REF-243 | FILE-243 | /api/v1/introspect/tests/unit/deploy-scripts.test.ts | Read-only operator |
| REF-244 | FILE-244 | /api/v1/introspect/tests/unit/deployment.test.ts | Read-only operator |
| REF-245 | FILE-245 | /api/v1/introspect/tests/unit/derive-address.test.mjs | Read-only operator |
| REF-246 | FILE-246 | /api/v1/introspect/tests/unit/equity-curve.test.ts | Read-only operator |
| REF-247 | FILE-247 | /api/v1/introspect/tests/unit/executor.test.ts | Read-only operator |
| REF-248 | FILE-248 | /api/v1/introspect/tests/unit/exit-policy-profit-only.test.ts | Read-only operator |
| REF-249 | FILE-249 | /api/v1/introspect/tests/unit/key-source-file.test.ts | Read-only operator |
| REF-250 | FILE-250 | /api/v1/introspect/tests/unit/key-source.test.ts | Read-only operator |
| REF-251 | FILE-251 | /api/v1/introspect/tests/unit/limits.test.ts | Read-only operator |
| REF-252 | FILE-252 | /api/v1/introspect/tests/unit/logger.test.ts | Read-only operator |
| REF-253 | FILE-253 | /api/v1/introspect/tests/unit/memecoin-filter.test.ts | Read-only operator |
| REF-254 | FILE-254 | /api/v1/introspect/tests/unit/merge.test.ts | Read-only operator |
| REF-255 | FILE-255 | /api/v1/introspect/tests/unit/mode-switch.test.ts | Read-only operator |
| REF-256 | FILE-256 | /api/v1/introspect/tests/unit/model-tiering.test.ts | Read-only operator |
| REF-257 | FILE-257 | /api/v1/introspect/tests/unit/operational-logging.test.ts | Read-only operator |
| REF-258 | FILE-258 | /api/v1/introspect/tests/unit/prompt-prefix-stable.test.ts | Read-only operator |
| REF-259 | FILE-259 | /api/v1/introspect/tests/unit/provider-adapter.test.ts | Read-only operator |
| REF-260 | FILE-260 | /api/v1/introspect/tests/unit/recon-a-scope.test.ts | Read-only operator |
| REF-261 | FILE-261 | /api/v1/introspect/tests/unit/recon-a.test.ts | Read-only operator |
| REF-262 | FILE-262 | /api/v1/introspect/tests/unit/recon-b-handoff.test.ts | Read-only operator |
| REF-263 | FILE-263 | /api/v1/introspect/tests/unit/recon-b.test.ts | Read-only operator |
| REF-264 | FILE-264 | /api/v1/introspect/tests/unit/recon-c.test.ts | Read-only operator |
| REF-265 | FILE-265 | /api/v1/introspect/tests/unit/response-cache.test.ts | Read-only operator |
| REF-266 | FILE-266 | /api/v1/introspect/tests/unit/risk-config-journal.test.ts | Read-only operator |
| REF-267 | FILE-267 | /api/v1/introspect/tests/unit/router-cost-first.test.ts | Read-only operator |
| REF-268 | FILE-268 | /api/v1/introspect/tests/unit/router-fallback.test.ts | Read-only operator |
| REF-269 | FILE-269 | /api/v1/introspect/tests/unit/rug-check.test.ts | Read-only operator |
| REF-270 | FILE-270 | /api/v1/introspect/tests/unit/scanner.test.ts | Read-only operator |
| REF-271 | FILE-271 | /api/v1/introspect/tests/unit/schema-validation.test.ts | Read-only operator |
| REF-272 | FILE-272 | /api/v1/introspect/tests/unit/signer-bitcoin.test.ts | Read-only operator |
| REF-273 | FILE-273 | /api/v1/introspect/tests/unit/signer-evm.test.ts | Read-only operator |
| REF-274 | FILE-274 | /api/v1/introspect/tests/unit/signer-solana.test.ts | Read-only operator |
| REF-275 | FILE-275 | /api/v1/introspect/tests/unit/sizer.test.ts | Read-only operator |
| REF-276 | FILE-276 | /api/v1/introspect/tests/unit/sizing-math.test.ts | Read-only operator |
| REF-277 | FILE-277 | /api/v1/introspect/tests/unit/strategy-aggregator.test.ts | Read-only operator |
| REF-278 | FILE-278 | /api/v1/introspect/tests/unit/strategy-determinism.test.ts | Read-only operator |
| REF-279 | FILE-279 | /api/v1/introspect/tests/unit/strategy-registry.test.ts | Read-only operator |
| REF-280 | FILE-280 | /api/v1/introspect/tests/unit/timeout-ladder.test.ts | Read-only operator |
| REF-281 | FILE-281 | /api/v1/introspect/tests/unit/trade-history-projection.test.ts | Read-only operator |
| REF-282 | FILE-282 | /api/v1/introspect/tests/unit/ttl.test.ts | Read-only operator |
| REF-283 | FILE-283 | /api/v1/introspect/tests/wallet-fixture.ts | Read-only operator |
| REF-284 | FILE-284 | /api/v1/introspect/root/tsconfig.build.json | Read-only operator |
| REF-285 | FILE-285 | /api/v1/introspect/root/tsconfig.json | Read-only operator |

## Table 3 — Capability and compatibility endpoints

Existing parameters come from the approved contract or router. Proposed parameters are design inputs and will receive exact Zod schemas during implementation. Mutation rows inherit Idempotency-Key and dry_run unless they are legacy compatibility paths.

| Capability ID | HTTP endpoint | Inputs | Response | Authorization | File ID | Status |
| --- | --- | --- | --- | --- | --- | --- |
| CTL-001 | POST /api/v1/controls/kill-switch | { flatten: boolean, request_id? } | Receipt with action `emergency_stop` and details for both `entries_paused` and `live_execution_disarmed` | Operator | FILE-127 | EP-001 · Proposed |
| CTL-002 | POST /api/v1/controls/pause | Optional request_id | Receipt | Operator | FILE-127 | EP-002 · Existing |
| CTL-003 | POST /api/v1/controls/resume | Optional request_id | Receipt | Operator | FILE-127 | EP-003 · Existing |
| CTL-004 | POST /api/v1/controls/live-execution | enabled boolean and optional request_id | Receipt | Operator disarm; scope + recent MFA to arm | FILE-127 | EP-004 · Existing |
| CTL-005 | POST /api/v1/controls/exits/pause | { request_id? } | Receipt | Scope + recent MFA | FILE-127 | EP-005 · Proposed |
| CTL-006 | POST /api/v1/controls/exits/resume | { request_id? } | Receipt | Scope + recent MFA | FILE-127 | EP-006 · Proposed |
| CTL-007 | POST /api/v1/mode | config: ModeConfig, required reason, optional request_id | Receipt | Scope + recent MFA | FILE-124 | EP-007 · Existing |
| CTL-008 | POST /api/v1/controls/circuit-breaker/reset | { request_id? } | Receipt | Scope + recent MFA | FILE-127 | EP-008 · Proposed |
| CTL-009 | GET /api/v1/trades/export | Same filters as TRADES_ALIAS, no cursor | text/csv | Read-only operator | FILE-142 | EP-009 · Proposed |
| CTL-010 | POST /api/v1/strategies/:id/enable | Canonical id in path, optional request_id | Receipt | Scope + recent MFA | FILE-124 | EP-010 · Existing |
| CTL-011 | POST /api/v1/strategies/:id/disable | Canonical id in path, optional request_id | Receipt | Scope + recent MFA | FILE-124 | EP-011 · Existing |
| CTL-012 | POST /api/v1/controls/chain | config: ChainRouting; optional request_id | Receipt | Scope + recent MFA | FILE-124 | EP-012 · Existing, partial |
| CTL-013 | GET /api/v1/positions/:id | Canonical run ID | Position item, nullable exit policy and journal events | Read-only operator | FILE-126 | EP-013 · Proposed |
| CTL-014 | POST /api/v1/controls/exit | run_id or chain and canonical token address; optional request_id | Receipt | Scope + recent MFA | FILE-126 | EP-014 · Existing, partial |
| CTL-015 | GET /api/v1/trades | Same query as TRADES; optional strategy_id for desk filtering | 200 { items: TradeRead[], next_cursor: string or null } | Read-only operator | FILE-142 | EP-015 · Proposed |
| CTL-016 | GET /api/v1/trades/:id | Canonical run ID | TradeRead and audit trail | Read-only operator | FILE-142 | EP-016 · Proposed |
| CTL-017 | POST /api/v1/controls/risk | { config: RiskConfig, limits?, expected_risk_revision?, expected_limits_revision?, request_id? } | Receipt | Scope + recent MFA | FILE-126 | EP-017 · Existing, extend write |
| CTL-018 | POST /api/v1/controls/trading-limits | { daily_entry_limit_usd, per_trade_limit_usd, expected_revision, request_id? } | Receipt | Scope + recent MFA | FILE-126 | EP-018 · Proposed |
| CTL-019 | GET /api/v1/strategies/:id | Canonical strategy ID | Registry item and nullable recent signals and trades | Read-only operator | FILE-124 | EP-019 · Existing phase3 detail; extend projection |
| CTL-020 | POST /api/v1/strategies/:id/params | Canonical id, params object, optional request_id | Receipt | Scope + recent MFA | FILE-124 | EP-020 · Existing, partial |
| CTL-021 | POST /api/v1/providers/:id/enable | Canonical id, optional request_id | Receipt | Scope + recent MFA | FILE-124 | EP-021 · Existing |
| CTL-022 | POST /api/v1/providers/:id/disable | Canonical id, optional request_id | Receipt | Scope + recent MFA | FILE-124 | EP-022 · Existing |
| CTL-023 | POST /api/v1/controls/providers/order | { provider_ids: string[], expected_revision: string, request_id? } | Receipt | Scope + recent MFA | FILE-124 | EP-023 · Proposed |
| CTL-024 | POST /api/v1/quote | { chain, token, side, size_usd, slippage_bps, mev_mode } | 200 QuoteRead | Read-only operator | FILE-126 | EP-024 · Proposed |
| CTL-025 | POST /api/v1/controls/manual-trade | { quote_id, request_id? } | Receipt | Scope + recent MFA | FILE-126 | EP-025 · Proposed, paper |
| CTL-026 | GET /api/v1/audit/export | Same filters as AUDIT, no cursor | application/x-ndjson | Read-only operator | FILE-126 | EP-026 · Proposed |
| CTL-027 | GET /api/v1/audit | limit 1–200, since ISO, integer cursor | items of JournalEvent and next_cursor | Read-only operator | FILE-126 | EP-027 · Existing, extend projection |
| CTL-028 | GET /api/v1/system/diagnostics | None | Status, last 100 events, allow-listed non-secret config | Read-only operator | FILE-126 | EP-028 · Proposed |
| CTL-029 | GET /api/v1/performance | range or since/until | 200 PerformanceRead | Read-only operator | FILE-142 | EP-029 · Proposed |
| CTL-030 | GET /api/v1/funnel | range or since/until | 200 { since, until, counts, reasons, bins } | Read-only operator | FILE-126 | EP-030 · Proposed |
| CTL-031 | GET /api/v1/status | None | loop_state, last_cycle_at, breaker_open, breaker_until, entries_paused, execution_mode, live_execution_enabled, open_positions, current_equity, drawdown_pct | Read-only operator | FILE-126 | EP-031 · Existing, extend projection |
| CTL-032 | GET /api/v1/mode | None | ModeConfig | Read-only operator | FILE-124 | EP-032 · Existing |
| CTL-033 | GET /api/v1/positions | None | items of journal positions, age_sec, nullable mark and unrealized_pnl_usd | Read-only operator | FILE-126 | EP-033 · Existing, extend projection |
| CTL-034 | GET /api/v1/strategies | None | items from strategy registry, signals and journal history | Read-only operator | FILE-124 | EP-034 · Existing, partial |
| CTL-035 | GET /api/v1/chains | Optional range | 200 { items: ChainRead[], config: ChainRouting } | Read-only operator | FILE-124 | EP-035 · Proposed |
| CTL-036 | GET /api/v1/equity | None | latest and history of Equity Curve publications | Read-only operator | FILE-126 | EP-036 · Existing, partial |
| CTL-037 | GET /api/v1/risk | None | config, as_of, actor | Read-only operator | FILE-126 | EP-037 · Existing, partial |
| CTL-038 | GET /api/v1/trading-limits | None | 200 { daily_entry_limit_usd, per_trade_limit_usd, revision } | Read-only operator | FILE-126 | EP-038 · Proposed |
| CTL-039 | GET /api/v1/receipts/:request_id | Request ID in path | 200 Receipt | Read-only operator | FILE-126 | EP-039 · Proposed |
| CTL-040 | GET /api/v1/providers | None | items from provider configuration and usage projection | Read-only operator | FILE-124 | EP-040 · Existing, partial |
| CTL-041 | GET /api/v1/system/health | None | 200 SystemRead | Read-only operator | FILE-126 | EP-041 · Implemented in batch 1 |
| CTL-042 | GET /api/v1/health | None | 200 authenticated health; loopback deploy probe uses its existing shape | Read-only operator | FILE-130 | Existing |
| CTL-043 | GET /api/v1/candidates | None | 200 scanner batch and watched targets | Read-only operator | FILE-126 | Existing |
| CTL-044 | GET /api/v1/wallets | None | 200 public wallet capability projection | Read-only operator | FILE-132 | Existing |
| CTL-045 | GET /api/v1/chain | None | 200 ChainRouting | Read-only operator | FILE-124 | Existing |
| CTL-046 | GET /api/v1/budget | None | 200 model budget and spend counters | Read-only operator | FILE-124 | Existing |
| CTL-047 | GET /api/v1/signals | None | 200 recent signals | Read-only operator | FILE-124 | Existing |
| CTL-048 | GET /api/v1/providers/:id | Path id | 200 provider detail | Read-only operator | FILE-124 | Existing |
| CTL-049 | POST /api/v1/controls/reject | chain, token, request_id? | 202 Receipt; 200 replay with original request_id | Operator | FILE-126 | Existing |
| CTL-050 | POST /api/v1/budget | config: BudgetConfig, request_id? | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-124 | Existing model budget |
| CTL-051 | POST /api/v1/chain | config: ChainRouting, request_id? | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-124 | Existing alias |
| CTL-052 | POST /api/v1/strategies/reload | request_id? | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-124 | Existing |
| CTL-053 | POST /api/v1/controls/approve/:id | Signal id, request_id? | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-124 | Existing |
| CTL-054 | POST /api/v1/controls/reject/:id | Signal id, request_id? | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-124 | Existing |
| CTL-055 | GET /health | None | 200 legacy process status | Read-only operator | FILE-130 | Existing compatibility |
| CTL-056 | GET /equity | None | 200 legacy equity summary | Read-only operator | FILE-130 | Existing compatibility |
| CTL-057 | GET /journal | from?, to?, run_id?, limit? | 200 audit events | Read-only operator | FILE-130 | Existing compatibility |
| CTL-058 | GET /live-view | token? | 200 live views | Read-only operator | FILE-130 | Existing compatibility |
| CTL-059 | GET /live-view/stream | token? | SSE live views; MCP uses an equivalent bounded snapshot | Read-only operator | FILE-130 | Existing compatibility |
| CTL-060 | GET /trades | from?, to?, token?, cursor?, limit? | 200 legacy trade page | Read-only operator | FILE-130 | Existing compatibility |
| CTL-061 | GET /risk-config | None | 200 legacy risk config | Read-only operator | FILE-130 | Existing compatibility |
| CTL-062 | POST /risk-config | RiskConfig | 202 legacy risk receipt | Scope + recent MFA | FILE-130 | Existing compatibility |
| CTL-063 | GET /internal/health | None | 200 loopback process health | Loopback only; MCP profile excludes | FILE-130 | Existing compatibility endpoint |
| CTL-064 | POST /api/v1/agents/:id/enable | Agent id, expected_revision | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-107 | Proposed runtime capability |
| CTL-065 | POST /api/v1/agents/:id/disable | Agent id, expected_revision; core safety agents ineligible | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-107 | Proposed runtime capability |
| CTL-066 | PATCH /api/v1/agents/:id/params | Agent id, typed allowed params, expected_revision | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-107 | Proposed runtime capability |
| CTL-067 | POST /api/v1/cache/recon/clear | Explicit chain/scope | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-118 | Proposed runtime capability |
| CTL-068 | POST /api/v1/cache/recon/invalidate | Canonical chain and token | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-118 | Proposed runtime capability |
| CTL-069 | PUT /api/v1/cache/recon/ttl | Bounded ttl_ms, expected_revision | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-119 | Proposed runtime capability |
| CTL-070 | PUT /api/v1/chains/:id/allocation | Chain id, allocation_pct, expected_revision | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-120 | Proposed runtime capability |
| CTL-071 | PUT /api/v1/chains/:id/memecoin-filter | Chain id, enabled, expected_revision | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-120 | Proposed runtime capability |
| CTL-072 | PATCH /api/v1/config/non-secret | Known typed runtime keys, expected_revision | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-011 | Proposed runtime capability |
| CTL-073 | PUT /api/v1/exits/policy | ExitPolicy and expected_revision | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-135 | Proposed runtime capability |
| CTL-074 | PUT /api/v1/live/publisher/interval | Bounded interval_ms, expected_revision | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-138 | Proposed runtime capability |
| CTL-075 | PUT /api/v1/orchestrator/interval | Bounded interval_ms, expected_revision; preserve deploy heartbeat semantics | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-153 | Proposed runtime capability |
| CTL-076 | POST /api/v1/orchestrator/reconcile | Existing pending transaction or bounded scope; observe only | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-205 | Proposed runtime capability |
| CTL-077 | POST /api/v1/orchestrator/recon/refresh | Canonical chain and token filter | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-155 | Proposed runtime capability |
| CTL-078 | PUT /api/v1/providers/:id/budget | Provider id, bounded daily budget, expected_revision | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-158 | Proposed runtime capability |
| CTL-079 | POST /api/v1/state/equity/refresh | None | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-162 | Proposed runtime capability |
| CTL-080 | PUT /api/v1/wallet/limits | Validated limits and expected revision | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-207 | Proposed runtime capability |
| CTL-081 | POST /api/v1/watchlist | Canonical chain and token | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-126 | Proposed runtime capability |
| CTL-082 | DELETE /api/v1/watchlist/:id | Canonical watchlist id | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-126 | Proposed runtime capability |
| CTL-083 | POST /api/v1/rejections | Canonical chain and token, reason | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-126 | Proposed runtime capability |
| CTL-084 | DELETE /api/v1/rejections/:id | Rejection id and reason | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-126 | Proposed runtime capability |
| CTL-085 | PATCH /api/v1/settings | Typed runtime settings and expected revision | 202 Receipt; 200 replay with original request_id | Scope + recent MFA | FILE-124 | Proposed runtime capability |
| CTL-086 | GET /api/v1/watchlist | limit?, cursor?, chain? | 200 watched targets | Read-only operator | FILE-126 | Proposed |
| CTL-087 | GET /api/v1/rejections | limit?, cursor?, chain? | 200 permanent rejections | Read-only operator | FILE-126 | Proposed |
| CTL-088 | GET /api/v1/settings | fields?, verbose? | 200 non-secret runtime configuration | Read-only operator | FILE-124 | Proposed |
| CTL-089 | GET /api/v1/system/api-log | actor?, path?, method?, since?, until?, limit?, cursor? | 200 redacted records and next_cursor | Read-only operator | FILE-140 | Proposed |
| CTL-090 | POST /api/v1/introspect/cache/ttl.ts/invoke | observed_at, ttl_ms, now | 200 validated result | Read-only operator | FILE-119 | Proposed pure invocation |
| CTL-091 | POST /api/v1/introspect/state/equity.ts/invoke | requested_cents, equity_cents, available_cents, limit_bps | 200 validated result | Read-only operator | FILE-162 | Proposed pure invocation |
| CTL-092 | POST /api/v1/introspect/exits/policy.ts/invoke | ExitPolicy, mark {price, at} | 200 validated result | Read-only operator | FILE-135 | Proposed pure invocation |
| CTL-093 | POST /api/v1/introspect/schemas/recon-checks.ts/invoke | validated Recon B fields for transformation | 200 validated result | Read-only operator | FILE-095 | Proposed pure invocation |
| CTL-094 | POST /api/v1/introspect/schemas/risk-config.ts/invoke | value validated with pinned Zod schema | 200 validated result | Read-only operator | FILE-097 | Proposed validation only |
| CTL-095 | POST /api/v1/introspect/schemas/chain-routing.ts/invoke | value validated with pinned Zod schema | 200 validated result | Read-only operator | FILE-082 | Proposed validation only |
| CTL-096 | POST /api/v1/introspect/schemas/mode-config.ts/invoke | value validated with pinned Zod schema | 200 validated result | Read-only operator | FILE-090 | Proposed validation only |
| CTL-097 | POST /api/v1/introspect/schemas/budget.ts/invoke | value validated with pinned Zod schema | 200 validated result | Read-only operator | FILE-081 | Proposed validation only |
| CTL-098 | POST /api/v1/introspect/schemas/exit-policy.ts/invoke | value validated with pinned Zod schema | 200 validated result | Read-only operator | FILE-087 | Proposed validation only |
| CTL-099 | POST /api/v1/tools/dexscreener | Canonical chain and token/pair where required; rate-limited | 200 sanitized provider result | Operator | FILE-194 | Proposed bounded provider read |
| CTL-100 | POST /api/v1/tools/geckoterminal | Canonical chain and token/pair where required; rate-limited | 200 sanitized provider result | Operator | FILE-196 | Proposed bounded provider read |
| CTL-101 | POST /api/v1/tools/goplus | Canonical chain and token/pair where required; rate-limited | 200 sanitized provider result | Operator | FILE-197 | Proposed bounded provider read |
| CTL-102 | POST /api/v1/tools/honeypot-is | Canonical chain and token/pair where required; rate-limited | 200 sanitized provider result | Operator | FILE-198 | Proposed bounded provider read |
| CTL-103 | POST /api/v1/tools/rugcheck-xyz | Canonical chain and token/pair where required; rate-limited | 200 sanitized provider result | Operator | FILE-201 | Proposed bounded provider read |

## Table 4 — MCP tools

The rows below describe the proposed complete mapping. Existing deployed MCP names remain compatibility aliases where needed. Redaction rules and parameter validation match REST.

| MCP ID | Endpoint ID | Proposed tool | Safety | Parameters |
| --- | --- | --- | --- | --- |
| MCP-001 | REF-001 | introspect_root_dockerignore | Read-only file metadata | fields?, expand?, verbose? |
| MCP-002 | REF-002 | introspect_root_env_example | Read-only file metadata | fields?, expand?, verbose? |
| MCP-003 | REF-003 | introspect_github_dependabot_yml | Read-only file metadata | fields?, expand?, verbose? |
| MCP-004 | REF-004 | introspect_github_scripts_ghcr_cleanup_sh | Read-only file metadata | fields?, expand?, verbose? |
| MCP-005 | REF-005 | introspect_github_workflows_ci_yml | Read-only file metadata | fields?, expand?, verbose? |
| MCP-006 | REF-006 | introspect_github_workflows_deploy_yml | Read-only file metadata | fields?, expand?, verbose? |
| MCP-007 | REF-007 | introspect_root_gitignore | Read-only file metadata | fields?, expand?, verbose? |
| MCP-008 | REF-008 | introspect_root_nvmrc | Read-only file metadata | fields?, expand?, verbose? |
| MCP-009 | REF-009 | introspect_root_license | Read-only file metadata | fields?, expand?, verbose? |
| MCP-010 | REF-010 | introspect_root_readme_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-011 | REF-011 | introspect_config_default_json | Read-only file metadata | fields?, expand?, verbose? |
| MCP-012 | REF-012 | introspect_config_models_json | Read-only file metadata | fields?, expand?, verbose? |
| MCP-013 | REF-013 | introspect_config_providers_json | Read-only file metadata | fields?, expand?, verbose? |
| MCP-014 | REF-014 | introspect_deploy_readme_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-015 | REF-015 | introspect_deploy_cicd_readme_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-016 | REF-016 | introspect_deploy_cicd_addresses_json | Read-only file metadata | fields?, expand?, verbose? |
| MCP-017 | REF-017 | introspect_deploy_cicd_deploy_sh | Read-only file metadata | fields?, expand?, verbose? |
| MCP-018 | REF-018 | introspect_deploy_cicd_dex_deploy_tmpfiles_conf | Read-only file metadata | fields?, expand?, verbose? |
| MCP-019 | REF-019 | introspect_deploy_cicd_healthcheck_sh | Read-only file metadata | fields?, expand?, verbose? |
| MCP-020 | REF-020 | introspect_deploy_cicd_install_deploy_key_sh | Read-only file metadata | fields?, expand?, verbose? |
| MCP-021 | REF-021 | introspect_deploy_cicd_lib_derive_address_mjs | Read-only file metadata | fields?, expand?, verbose? |
| MCP-022 | REF-022 | introspect_deploy_cicd_lib_install_derive_tools_sh | Read-only file metadata | fields?, expand?, verbose? |
| MCP-023 | REF-023 | introspect_deploy_cicd_lib_wallet_log_sh | Read-only file metadata | fields?, expand?, verbose? |
| MCP-024 | REF-024 | introspect_deploy_cicd_rollback_sh | Read-only file metadata | fields?, expand?, verbose? |
| MCP-025 | REF-025 | introspect_deploy_cicd_setup_secrets_sh | Read-only file metadata | fields?, expand?, verbose? |
| MCP-026 | REF-026 | introspect_deploy_cicd_ssh_deploy_sh | Read-only file metadata | fields?, expand?, verbose? |
| MCP-027 | REF-027 | introspect_deploy_cicd_verify_secrets_sh | Read-only file metadata | fields?, expand?, verbose? |
| MCP-028 | REF-028 | introspect_deploy_docker_dockerignore | Read-only file metadata | fields?, expand?, verbose? |
| MCP-029 | REF-029 | introspect_deploy_docker_dockerfile | Read-only file metadata | fields?, expand?, verbose? |
| MCP-030 | REF-030 | introspect_deploy_docker_docker_compose_dev_yml | Read-only file metadata | fields?, expand?, verbose? |
| MCP-031 | REF-031 | introspect_deploy_docker_docker_compose_yml | Read-only file metadata | fields?, expand?, verbose? |
| MCP-032 | REF-032 | introspect_deploy_fail2ban_jail_local | Read-only file metadata | fields?, expand?, verbose? |
| MCP-033 | REF-033 | introspect_deploy_nginx_dex_orchestrator_conf | Read-only file metadata | fields?, expand?, verbose? |
| MCP-034 | REF-034 | introspect_deploy_scripts_00_bootstrap_sh | Read-only file metadata | fields?, expand?, verbose? |
| MCP-035 | REF-035 | introspect_deploy_scripts_01_docker_install_sh | Read-only file metadata | fields?, expand?, verbose? |
| MCP-036 | REF-036 | introspect_deploy_scripts_02_secrets_init_sh | Read-only file metadata | fields?, expand?, verbose? |
| MCP-037 | REF-037 | introspect_deploy_scripts_03_nginx_setup_sh | Read-only file metadata | fields?, expand?, verbose? |
| MCP-038 | REF-038 | introspect_deploy_scripts_04_deploy_sh | Read-only file metadata | fields?, expand?, verbose? |
| MCP-039 | REF-039 | introspect_deploy_scripts_99_verify_sh | Read-only file metadata | fields?, expand?, verbose? |
| MCP-040 | REF-040 | introspect_deploy_scripts_common_sh | Read-only file metadata | fields?, expand?, verbose? |
| MCP-041 | REF-041 | introspect_deploy_systemd_dex_dashboard_service | Read-only file metadata | fields?, expand?, verbose? |
| MCP-042 | REF-042 | introspect_deploy_systemd_dex_mcp_service | Read-only file metadata | fields?, expand?, verbose? |
| MCP-043 | REF-043 | introspect_deploy_systemd_dex_worker_service | Read-only file metadata | fields?, expand?, verbose? |
| MCP-044 | REF-044 | introspect_docs_adr_0001_runtime_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-045 | REF-045 | introspect_docs_adr_0002_language_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-046 | REF-046 | introspect_docs_adr_0003_gpt_and_plugin_retirement_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-047 | REF-047 | introspect_docs_adr_0004_dashboard_and_tradekeel_reuse_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-048 | REF-048 | introspect_docs_adr_0005_control_plane_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-049 | REF-049 | introspect_docs_architecture_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-050 | REF-050 | introspect_docs_backend_requirements_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-051 | REF-051 | introspect_docs_conformance_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-052 | REF-052 | introspect_docs_dashboard_api_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-053 | REF-053 | introspect_docs_dashboard_auth_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-054 | REF-054 | introspect_docs_frontend_api_contract_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-055 | REF-055 | introspect_docs_frontend_backend_contract_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-056 | REF-056 | introspect_docs_frontend_non_actions_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-057 | REF-057 | introspect_docs_hermes_integration_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-058 | REF-058 | introspect_docs_live_runbook_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-059 | REF-059 | introspect_docs_prompts_phase_5_cicd_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-060 | REF-060 | introspect_docs_rollback_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-061 | REF-061 | introspect_docs_schemas_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-062 | REF-062 | introspect_docs_secrets_runbook_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-063 | REF-063 | introspect_docs_strategies_md | Read-only file metadata | fields?, expand?, verbose? |
| MCP-064 | REF-064 | introspect_fixtures_dexscreener_ethereum_weth_json | Read-only file metadata | fields?, expand?, verbose? |
| MCP-065 | REF-065 | introspect_fixtures_goplus_ethereum_usdc_json | Read-only file metadata | fields?, expand?, verbose? |
| MCP-066 | REF-066 | introspect_fixtures_honeypot_is_ethereum_usdc_json | Read-only file metadata | fields?, expand?, verbose? |
| MCP-067 | REF-067 | introspect_fixtures_rugcheck_solana_wsol_json | Read-only file metadata | fields?, expand?, verbose? |
| MCP-068 | REF-068 | introspect_root_health_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-069 | REF-069 | introspect_root_package_lock_json | Read-only file metadata | fields?, expand?, verbose? |
| MCP-070 | REF-070 | introspect_root_package_json | Read-only file metadata | fields?, expand?, verbose? |
| MCP-071 | REF-080 | introspect_public_robots_txt | Read-only file metadata | fields?, expand?, verbose? |
| MCP-072 | REF-081 | introspect_schemas_budget_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-073 | REF-082 | introspect_schemas_chain_routing_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-074 | REF-083 | introspect_schemas_common_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-075 | REF-084 | introspect_schemas_control_plane_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-076 | REF-085 | introspect_schemas_equity_curve_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-077 | REF-086 | introspect_schemas_executor_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-078 | REF-087 | introspect_schemas_exit_policy_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-079 | REF-088 | introspect_schemas_live_view_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-080 | REF-089 | introspect_schemas_logger_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-081 | REF-090 | introspect_schemas_mode_config_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-082 | REF-091 | introspect_schemas_provider_config_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-083 | REF-092 | introspect_schemas_recon_a_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-084 | REF-093 | introspect_schemas_recon_b_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-085 | REF-094 | introspect_schemas_recon_c_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-086 | REF-095 | introspect_schemas_recon_checks_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-087 | REF-096 | introspect_schemas_recon_snapshot_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-088 | REF-097 | introspect_schemas_risk_config_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-089 | REF-098 | introspect_schemas_rug_check_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-090 | REF-099 | introspect_schemas_scanner_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-091 | REF-100 | introspect_schemas_signal_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-092 | REF-101 | introspect_schemas_sizer_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-093 | REF-102 | introspect_schemas_strategy_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-094 | REF-103 | introspect_schemas_trade_history_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-095 | REF-104 | introspect_schemas_transaction_intent_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-096 | REF-105 | introspect_schemas_tx_result_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-097 | REF-106 | introspect_schemas_wallet_config_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-098 | REF-107 | introspect_agents_call_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-099 | REF-108 | introspect_agents_equity_curve_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-100 | REF-109 | introspect_agents_executor_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-101 | REF-110 | introspect_agents_logger_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-102 | REF-111 | introspect_agents_recon_a_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-103 | REF-112 | introspect_agents_recon_b_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-104 | REF-113 | introspect_agents_recon_c_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-105 | REF-114 | introspect_agents_rug_check_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-106 | REF-115 | introspect_agents_scanner_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-107 | REF-116 | introspect_agents_sizer_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-108 | REF-117 | introspect_cache_merge_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-109 | REF-118 | introspect_cache_recon_cache_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-110 | REF-119 | introspect_cache_ttl_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-111 | REF-120 | introspect_chain_router_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-112 | REF-121 | introspect_config_secrets_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-113 | REF-122 | introspect_control_commands_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-114 | REF-123 | introspect_control_config_journals_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-115 | REF-124 | introspect_control_phase3_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-116 | REF-125 | introspect_control_plane_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-117 | REF-126 | introspect_control_service_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-118 | REF-127 | introspect_control_worker_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-119 | REF-128 | introspect_dashboard_api_auth_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-120 | REF-129 | introspect_dashboard_api_jwt_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-121 | REF-130 | introspect_dashboard_api_routes_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-122 | REF-131 | introspect_dashboard_api_server_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-123 | REF-132 | introspect_dashboard_api_wallets_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-124 | REF-133 | introspect_exec_sidecar_client_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-125 | REF-134 | introspect_exec_signer_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-126 | REF-135 | introspect_exits_policy_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-127 | REF-136 | introspect_exits_watcher_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-128 | REF-137 | introspect_src_index_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-129 | REF-138 | introspect_live_publisher_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-130 | REF-139 | introspect_live_types_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-131 | REF-140 | introspect_logging_logger_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-132 | REF-141 | introspect_logging_operational_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-133 | REF-142 | introspect_logging_projections_trade_history_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-134 | REF-143 | introspect_logging_types_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-135 | REF-144 | introspect_mcp_http_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-136 | REF-145 | introspect_mcp_server_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-137 | REF-146 | introspect_mcp_tools_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-138 | REF-147 | introspect_mode_config_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-139 | REF-148 | introspect_mode_local_agent_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-140 | REF-149 | introspect_mode_runtime_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-141 | REF-150 | introspect_mode_switch_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-142 | REF-151 | introspect_orchestrator_deployment_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-143 | REF-152 | introspect_orchestrator_errors_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-144 | REF-153 | introspect_orchestrator_loop_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-145 | REF-154 | introspect_orchestrator_pipeline_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-146 | REF-155 | introspect_orchestrator_recon_refresh_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-147 | REF-156 | introspect_providers_adapter_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-148 | REF-157 | introspect_providers_agent_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-149 | REF-158 | introspect_providers_budget_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-150 | REF-159 | introspect_providers_cache_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-151 | REF-160 | introspect_providers_router_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-152 | REF-161 | introspect_providers_types_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-153 | REF-162 | introspect_state_equity_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-154 | REF-163 | introspect_state_positions_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-155 | REF-164 | introspect_state_risk_config_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-156 | REF-165 | introspect_strategies_aggregator_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-157 | REF-166 | introspect_strategies_builtin_anti_signal_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-158 | REF-167 | introspect_strategies_builtin_breakout_15m_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-159 | REF-168 | introspect_strategies_builtin_btc_correlation_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-160 | REF-169 | introspect_strategies_builtin_copy_trade_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-161 | REF-170 | introspect_strategies_builtin_dip_buy_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-162 | REF-171 | introspect_strategies_builtin_gas_aware_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-163 | REF-172 | introspect_strategies_builtin_holder_conc_drop_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-164 | REF-173 | introspect_strategies_builtin_holder_growth_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-165 | REF-174 | introspect_strategies_builtin_honeypot_recheck_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-166 | REF-175 | introspect_strategies_builtin_kelly_fraction_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-167 | REF-176 | introspect_strategies_builtin_liq_drain_exit_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-168 | REF-177 | introspect_strategies_builtin_liquidity_influx_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-169 | REF-178 | introspect_strategies_builtin_mean_revert_1h_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-170 | REF-179 | introspect_strategies_builtin_momentum_ladder_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-171 | REF-180 | introspect_strategies_builtin_multi_signal_consensus_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-172 | REF-181 | introspect_strategies_builtin_new_pair_momentum_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-173 | REF-182 | introspect_strategies_builtin_new_pool_snipe_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-174 | REF-183 | introspect_strategies_builtin_range_breakout_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-175 | REF-184 | introspect_strategies_builtin_rsi_oversold_5m_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-176 | REF-185 | introspect_strategies_builtin_session_aware_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-177 | REF-186 | introspect_strategies_builtin_time_of_day_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-178 | REF-187 | introspect_strategies_builtin_vol_mcap_ratio_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-179 | REF-188 | introspect_strategies_builtin_volume_spike_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-180 | REF-189 | introspect_strategies_builtin_whale_accum_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-181 | REF-190 | introspect_strategies_builtins_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-182 | REF-191 | introspect_strategies_evidence_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-183 | REF-192 | introspect_strategies_registry_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-184 | REF-193 | introspect_strategies_strategy_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-185 | REF-194 | introspect_tools_dexscreener_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-186 | REF-195 | introspect_tools_discovery_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-187 | REF-196 | introspect_tools_geckoterminal_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-188 | REF-197 | introspect_tools_goplus_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-189 | REF-198 | introspect_tools_honeypot_is_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-190 | REF-199 | introspect_tools_recon_action_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-191 | REF-200 | introspect_tools_recon_evidence_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-192 | REF-201 | introspect_tools_rugcheck_xyz_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-193 | REF-202 | introspect_tools_social_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-194 | REF-203 | introspect_wallet_broadcast_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-195 | REF-204 | introspect_wallet_config_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-196 | REF-205 | introspect_wallet_confirm_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-197 | REF-206 | introspect_wallet_key_source_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-198 | REF-207 | introspect_wallet_limits_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-199 | REF-208 | introspect_wallet_live_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-200 | REF-213 | introspect_wallet_simulate_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-201 | REF-214 | introspect_wallet_types_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-202 | REF-215 | introspect_tests_agent_fixture_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-203 | REF-216 | introspect_tests_control_fixture_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-204 | REF-217 | introspect_tests_deploy_cicd_sh | Read-only file metadata | fields?, expand?, verbose? |
| MCP-205 | REF-218 | introspect_tests_integration_agent_contracts_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-206 | REF-219 | introspect_tests_integration_ai_mode_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-207 | REF-220 | introspect_tests_integration_budget_degrade_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-208 | REF-221 | introspect_tests_integration_chain_switch_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-209 | REF-222 | introspect_tests_integration_control_api_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-210 | REF-223 | introspect_tests_integration_dashboard_api_auth_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-211 | REF-224 | introspect_tests_integration_dashboard_jwt_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-212 | REF-225 | introspect_tests_integration_deploy_health_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-213 | REF-226 | introspect_tests_integration_live_intent_e2e_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-214 | REF-227 | introspect_tests_integration_live_view_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-215 | REF-228 | introspect_tests_integration_mcp_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-216 | REF-229 | introspect_tests_integration_mode_switch_mid_cycle_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-217 | REF-230 | introspect_tests_integration_phase3_controls_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-218 | REF-231 | introspect_tests_integration_pipeline_smoke_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-219 | REF-232 | introspect_tests_integration_provider_failover_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-220 | REF-233 | introspect_tests_integration_recon_b_with_fixtures_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-221 | REF-234 | introspect_tests_integration_simulation_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-222 | REF-235 | introspect_tests_integration_strategies_only_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-223 | REF-236 | introspect_tests_integration_wallet_overview_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-224 | REF-237 | introspect_tests_phase3_fixture_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-225 | REF-238 | introspect_tests_phase3_market_preload_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-226 | REF-239 | introspect_tests_unit_aggregator_monotonic_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-227 | REF-240 | introspect_tests_unit_budget_exhaust_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-228 | REF-241 | introspect_tests_unit_chain_router_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-229 | REF-242 | introspect_tests_unit_controls_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-230 | REF-243 | introspect_tests_unit_deploy_scripts_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-231 | REF-244 | introspect_tests_unit_deployment_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-232 | REF-245 | introspect_tests_unit_derive_address_test_mjs | Read-only file metadata | fields?, expand?, verbose? |
| MCP-233 | REF-246 | introspect_tests_unit_equity_curve_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-234 | REF-247 | introspect_tests_unit_executor_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-235 | REF-248 | introspect_tests_unit_exit_policy_profit_only_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-236 | REF-249 | introspect_tests_unit_key_source_file_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-237 | REF-250 | introspect_tests_unit_key_source_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-238 | REF-251 | introspect_tests_unit_limits_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-239 | REF-252 | introspect_tests_unit_logger_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-240 | REF-253 | introspect_tests_unit_memecoin_filter_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-241 | REF-254 | introspect_tests_unit_merge_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-242 | REF-255 | introspect_tests_unit_mode_switch_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-243 | REF-256 | introspect_tests_unit_model_tiering_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-244 | REF-257 | introspect_tests_unit_operational_logging_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-245 | REF-258 | introspect_tests_unit_prompt_prefix_stable_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-246 | REF-259 | introspect_tests_unit_provider_adapter_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-247 | REF-260 | introspect_tests_unit_recon_a_scope_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-248 | REF-261 | introspect_tests_unit_recon_a_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-249 | REF-262 | introspect_tests_unit_recon_b_handoff_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-250 | REF-263 | introspect_tests_unit_recon_b_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-251 | REF-264 | introspect_tests_unit_recon_c_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-252 | REF-265 | introspect_tests_unit_response_cache_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-253 | REF-266 | introspect_tests_unit_risk_config_journal_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-254 | REF-267 | introspect_tests_unit_router_cost_first_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-255 | REF-268 | introspect_tests_unit_router_fallback_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-256 | REF-269 | introspect_tests_unit_rug_check_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-257 | REF-270 | introspect_tests_unit_scanner_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-258 | REF-271 | introspect_tests_unit_schema_validation_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-259 | REF-272 | introspect_tests_unit_signer_bitcoin_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-260 | REF-273 | introspect_tests_unit_signer_evm_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-261 | REF-274 | introspect_tests_unit_signer_solana_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-262 | REF-275 | introspect_tests_unit_sizer_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-263 | REF-276 | introspect_tests_unit_sizing_math_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-264 | REF-277 | introspect_tests_unit_strategy_aggregator_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-265 | REF-278 | introspect_tests_unit_strategy_determinism_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-266 | REF-279 | introspect_tests_unit_strategy_registry_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-267 | REF-280 | introspect_tests_unit_timeout_ladder_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-268 | REF-281 | introspect_tests_unit_trade_history_projection_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-269 | REF-282 | introspect_tests_unit_ttl_test_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-270 | REF-283 | introspect_tests_wallet_fixture_ts | Read-only file metadata | fields?, expand?, verbose? |
| MCP-271 | REF-284 | introspect_root_tsconfig_build_json | Read-only file metadata | fields?, expand?, verbose? |
| MCP-272 | REF-285 | introspect_root_tsconfig_json | Read-only file metadata | fields?, expand?, verbose? |
| MCP-273 | CTL-001 | queue_controls_kill_switch | Runtime command; opt-in + MFA | { flatten: boolean, request_id? } |
| MCP-274 | CTL-002 | queue_controls_pause | Runtime command; opt-in + MFA | Optional request_id |
| MCP-275 | CTL-003 | queue_controls_resume | Runtime command; opt-in + MFA | Optional request_id |
| MCP-276 | CTL-004 | queue_controls_live_execution | Runtime command; opt-in + MFA | enabled boolean and optional request_id |
| MCP-277 | CTL-005 | queue_controls_exits_pause | Runtime command; opt-in + MFA | { request_id? } |
| MCP-278 | CTL-006 | queue_controls_exits_resume | Runtime command; opt-in + MFA | { request_id? } |
| MCP-279 | CTL-007 | queue_mode | Runtime command; opt-in + MFA | config: ModeConfig, required reason, optional request_id |
| MCP-280 | CTL-008 | queue_controls_circuit_breaker_reset | Runtime command; opt-in + MFA | { request_id? } |
| MCP-281 | CTL-009 | get_trades_export | Read-only response | Same filters as TRADES_ALIAS, no cursor |
| MCP-282 | CTL-010 | queue_strategies_id_enable | Runtime command; opt-in + MFA | Canonical id in path, optional request_id |
| MCP-283 | CTL-011 | queue_strategies_id_disable | Runtime command; opt-in + MFA | Canonical id in path, optional request_id |
| MCP-284 | CTL-012 | queue_controls_chain | Runtime command; opt-in + MFA | config: ChainRouting; optional request_id |
| MCP-285 | CTL-013 | get_positions_id | Read-only response | Canonical run ID |
| MCP-286 | CTL-014 | queue_controls_exit | Runtime command; opt-in + MFA | run_id or chain and canonical token address; optional request_id |
| MCP-287 | CTL-015 | get_trades | Read-only response | Same query as TRADES; optional strategy_id for desk filtering |
| MCP-288 | CTL-016 | get_trades_id | Read-only response | Canonical run ID |
| MCP-289 | CTL-017 | queue_controls_risk | Runtime command; opt-in + MFA | { config: RiskConfig, limits?, expected_risk_revision?, expected_limits_revision?, request_id? } |
| MCP-290 | CTL-018 | queue_controls_trading_limits | Runtime command; opt-in + MFA | { daily_entry_limit_usd, per_trade_limit_usd, expected_revision, request_id? } |
| MCP-291 | CTL-019 | get_strategies_id | Read-only response | Canonical strategy ID |
| MCP-292 | CTL-020 | queue_strategies_id_params | Runtime command; opt-in + MFA | Canonical id, params object, optional request_id |
| MCP-293 | CTL-021 | queue_providers_id_enable | Runtime command; opt-in + MFA | Canonical id, optional request_id |
| MCP-294 | CTL-022 | queue_providers_id_disable | Runtime command; opt-in + MFA | Canonical id, optional request_id |
| MCP-295 | CTL-023 | queue_controls_providers_order | Runtime command; opt-in + MFA | { provider_ids: string[], expected_revision: string, request_id? } |
| MCP-296 | CTL-024 | read_quote | Read-only response | { chain, token, side, size_usd, slippage_bps, mev_mode } |
| MCP-297 | CTL-025 | queue_controls_manual_trade | Runtime command; opt-in + MFA | { quote_id, request_id? } |
| MCP-298 | CTL-026 | get_audit_export | Read-only response | Same filters as AUDIT, no cursor |
| MCP-299 | CTL-027 | get_audit | Read-only response | limit 1–200, since ISO, integer cursor |
| MCP-300 | CTL-028 | get_system_diagnostics | Read-only response | None |
| MCP-301 | CTL-029 | get_performance | Read-only response | range or since/until |
| MCP-302 | CTL-030 | get_funnel | Read-only response | range or since/until |
| MCP-303 | CTL-031 | get_status | Read-only response | None |
| MCP-304 | CTL-032 | get_mode | Read-only response | None |
| MCP-305 | CTL-033 | get_positions | Read-only response | None |
| MCP-306 | CTL-034 | get_strategies | Read-only response | None |
| MCP-307 | CTL-035 | get_chains | Read-only response | Optional range |
| MCP-308 | CTL-036 | get_equity | Read-only response | None |
| MCP-309 | CTL-037 | get_risk | Read-only response | None |
| MCP-310 | CTL-038 | get_trading_limits | Read-only response | None |
| MCP-311 | CTL-039 | get_receipts_request_id | Read-only response | Request ID in path |
| MCP-312 | CTL-040 | get_providers | Read-only response | None |
| MCP-313 | CTL-041 | get_system_health | Read-only response | None |
| MCP-314 | CTL-042 | get_health | Read-only response | None |
| MCP-315 | CTL-043 | get_candidates | Read-only response | None |
| MCP-316 | CTL-044 | get_wallets | Read-only response | None |
| MCP-317 | CTL-045 | get_chain | Read-only response | None |
| MCP-318 | CTL-046 | get_budget | Read-only response | None |
| MCP-319 | CTL-047 | get_signals | Read-only response | None |
| MCP-320 | CTL-048 | get_providers_id | Read-only response | Path id |
| MCP-321 | CTL-049 | queue_controls_reject | Runtime command; opt-in + MFA | chain, token, request_id? |
| MCP-322 | CTL-050 | queue_budget | Runtime command; opt-in + MFA | config: BudgetConfig, request_id? |
| MCP-323 | CTL-051 | queue_chain | Runtime command; opt-in + MFA | config: ChainRouting, request_id? |
| MCP-324 | CTL-052 | queue_strategies_reload | Runtime command; opt-in + MFA | request_id? |
| MCP-325 | CTL-053 | queue_controls_approve_id | Runtime command; opt-in + MFA | Signal id, request_id? |
| MCP-326 | CTL-054 | queue_controls_reject_id | Runtime command; opt-in + MFA | Signal id, request_id? |
| MCP-327 | CTL-055 | get_legacy_health | Read-only response | None |
| MCP-328 | CTL-056 | get_legacy_equity | Read-only response | None |
| MCP-329 | CTL-057 | get_legacy_journal | Read-only response | from?, to?, run_id?, limit? |
| MCP-330 | CTL-058 | get_legacy_live_view | Read-only response | token? |
| MCP-331 | CTL-059 | get_legacy_live_view_stream | Read-only response | token? |
| MCP-332 | CTL-060 | get_legacy_trades | Read-only response | from?, to?, token?, cursor?, limit? |
| MCP-333 | CTL-061 | get_legacy_risk_config | Read-only response | None |
| MCP-334 | CTL-062 | queue_legacy_risk_config | Runtime command; opt-in + MFA | RiskConfig |
| MCP-335 | CTL-064 | queue_agents_id_enable | Runtime command; opt-in + MFA | Agent id, expected_revision |
| MCP-336 | CTL-065 | queue_agents_id_disable | Runtime command; opt-in + MFA | Agent id, expected_revision; core safety agents ineligible |
| MCP-337 | CTL-066 | update_agents_id_params | Runtime command; opt-in + MFA | Agent id, typed allowed params, expected_revision |
| MCP-338 | CTL-067 | queue_cache_recon_clear | Runtime command; opt-in + MFA | Explicit chain/scope |
| MCP-339 | CTL-068 | queue_cache_recon_invalidate | Runtime command; opt-in + MFA | Canonical chain and token |
| MCP-340 | CTL-069 | update_cache_recon_ttl | Runtime command; opt-in + MFA | Bounded ttl_ms, expected_revision |
| MCP-341 | CTL-070 | update_chains_id_allocation | Runtime command; opt-in + MFA | Chain id, allocation_pct, expected_revision |
| MCP-342 | CTL-071 | update_chains_id_memecoin_filter | Runtime command; opt-in + MFA | Chain id, enabled, expected_revision |
| MCP-343 | CTL-072 | update_config_non_secret | Runtime command; opt-in + MFA | Known typed runtime keys, expected_revision |
| MCP-344 | CTL-073 | update_exits_policy | Runtime command; opt-in + MFA | ExitPolicy and expected_revision |
| MCP-345 | CTL-074 | update_live_publisher_interval | Runtime command; opt-in + MFA | Bounded interval_ms, expected_revision |
| MCP-346 | CTL-075 | update_orchestrator_interval | Runtime command; opt-in + MFA | Bounded interval_ms, expected_revision; preserve deploy heartbeat semantics |
| MCP-347 | CTL-076 | queue_orchestrator_reconcile | Runtime command; opt-in + MFA | Existing pending transaction or bounded scope; observe only |
| MCP-348 | CTL-077 | queue_orchestrator_recon_refresh | Runtime command; opt-in + MFA | Canonical chain and token filter |
| MCP-349 | CTL-078 | update_providers_id_budget | Runtime command; opt-in + MFA | Provider id, bounded daily budget, expected_revision |
| MCP-350 | CTL-079 | queue_state_equity_refresh | Runtime command; opt-in + MFA | None |
| MCP-351 | CTL-080 | update_wallet_limits | Runtime command; opt-in + MFA | Validated limits and expected revision |
| MCP-352 | CTL-081 | queue_watchlist | Runtime command; opt-in + MFA | Canonical chain and token |
| MCP-353 | CTL-082 | delete_watchlist_id | Runtime command; opt-in + MFA | Canonical watchlist id |
| MCP-354 | CTL-083 | queue_rejections | Runtime command; opt-in + MFA | Canonical chain and token, reason |
| MCP-355 | CTL-084 | delete_rejections_id | Runtime command; opt-in + MFA | Rejection id and reason |
| MCP-356 | CTL-085 | update_settings | Runtime command; opt-in + MFA | Typed runtime settings and expected revision |
| MCP-357 | CTL-086 | get_watchlist | Read-only response | limit?, cursor?, chain? |
| MCP-358 | CTL-087 | get_rejections | Read-only response | limit?, cursor?, chain? |
| MCP-359 | CTL-088 | get_settings | Read-only response | fields?, verbose? |
| MCP-360 | CTL-089 | get_system_api_log | Read-only response | actor?, path?, method?, since?, until?, limit?, cursor? |
| MCP-361 | CTL-090 | invoke_introspect_cache_ttl_ts_invoke | Read-only response | observed_at, ttl_ms, now |
| MCP-362 | CTL-091 | invoke_introspect_state_equity_ts_invoke | Read-only response | requested_cents, equity_cents, available_cents, limit_bps |
| MCP-363 | CTL-092 | invoke_introspect_exits_policy_ts_invoke | Read-only response | ExitPolicy, mark {price, at} |
| MCP-364 | CTL-093 | invoke_introspect_schemas_recon_checks_ts_invoke | Read-only response | validated Recon B fields for transformation |
| MCP-365 | CTL-094 | invoke_introspect_schemas_risk_config_ts_invoke | Read-only response | value validated with pinned Zod schema |
| MCP-366 | CTL-095 | invoke_introspect_schemas_chain_routing_ts_invoke | Read-only response | value validated with pinned Zod schema |
| MCP-367 | CTL-096 | invoke_introspect_schemas_mode_config_ts_invoke | Read-only response | value validated with pinned Zod schema |
| MCP-368 | CTL-097 | invoke_introspect_schemas_budget_ts_invoke | Read-only response | value validated with pinned Zod schema |
| MCP-369 | CTL-098 | invoke_introspect_schemas_exit_policy_ts_invoke | Read-only response | value validated with pinned Zod schema |
| MCP-370 | CTL-099 | read_tools_dexscreener | Read-only response; external provider quota | Canonical chain and token/pair where required; rate-limited |
| MCP-371 | CTL-100 | read_tools_geckoterminal | Read-only response; external provider quota | Canonical chain and token/pair where required; rate-limited |
| MCP-372 | CTL-101 | read_tools_goplus | Read-only response; external provider quota | Canonical chain and token/pair where required; rate-limited |
| MCP-373 | CTL-102 | read_tools_honeypot_is | Read-only response; external provider quota | Canonical chain and token/pair where required; rate-limited |
| MCP-374 | CTL-103 | read_tools_rugcheck_xyz | Read-only response; external provider quota | Canonical chain and token/pair where required; rate-limited |

## Table 5 — Traceability

| Trace ID | File ID | Endpoint ID | MCP ID or explicit exception |
| --- | --- | --- | --- |
| TRC-001 | FILE-001 | REF-001 | MCP-001 |
| TRC-002 | FILE-002 | REF-002 | MCP-002 |
| TRC-003 | FILE-003 | REF-003 | MCP-003 |
| TRC-004 | FILE-004 | REF-004 | MCP-004 |
| TRC-005 | FILE-005 | REF-005 | MCP-005 |
| TRC-006 | FILE-006 | REF-006 | MCP-006 |
| TRC-007 | FILE-007 | REF-007 | MCP-007 |
| TRC-008 | FILE-008 | REF-008 | MCP-008 |
| TRC-009 | FILE-009 | REF-009 | MCP-009 |
| TRC-010 | FILE-010 | REF-010 | MCP-010 |
| TRC-011 | FILE-011 | REF-011 | MCP-011 |
| TRC-012 | FILE-012 | REF-012 | MCP-012 |
| TRC-013 | FILE-013 | REF-013 | MCP-013 |
| TRC-014 | FILE-014 | REF-014 | MCP-014 |
| TRC-015 | FILE-015 | REF-015 | MCP-015 |
| TRC-016 | FILE-016 | REF-016 | MCP-016 |
| TRC-017 | FILE-017 | REF-017 | MCP-017 |
| TRC-018 | FILE-018 | REF-018 | MCP-018 |
| TRC-019 | FILE-019 | REF-019 | MCP-019 |
| TRC-020 | FILE-020 | REF-020 | MCP-020 |
| TRC-021 | FILE-021 | REF-021 | MCP-021 |
| TRC-022 | FILE-022 | REF-022 | MCP-022 |
| TRC-023 | FILE-023 | REF-023 | MCP-023 |
| TRC-024 | FILE-024 | REF-024 | MCP-024 |
| TRC-025 | FILE-025 | REF-025 | MCP-025 |
| TRC-026 | FILE-026 | REF-026 | MCP-026 |
| TRC-027 | FILE-027 | REF-027 | MCP-027 |
| TRC-028 | FILE-028 | REF-028 | MCP-028 |
| TRC-029 | FILE-029 | REF-029 | MCP-029 |
| TRC-030 | FILE-030 | REF-030 | MCP-030 |
| TRC-031 | FILE-031 | REF-031 | MCP-031 |
| TRC-032 | FILE-032 | REF-032 | MCP-032 |
| TRC-033 | FILE-033 | REF-033 | MCP-033 |
| TRC-034 | FILE-034 | REF-034 | MCP-034 |
| TRC-035 | FILE-035 | REF-035 | MCP-035 |
| TRC-036 | FILE-036 | REF-036 | MCP-036 |
| TRC-037 | FILE-037 | REF-037 | MCP-037 |
| TRC-038 | FILE-038 | REF-038 | MCP-038 |
| TRC-039 | FILE-039 | REF-039 | MCP-039 |
| TRC-040 | FILE-040 | REF-040 | MCP-040 |
| TRC-041 | FILE-041 | REF-041 | MCP-041 |
| TRC-042 | FILE-042 | REF-042 | MCP-042 |
| TRC-043 | FILE-043 | REF-043 | MCP-043 |
| TRC-044 | FILE-044 | REF-044 | MCP-044 |
| TRC-045 | FILE-045 | REF-045 | MCP-045 |
| TRC-046 | FILE-046 | REF-046 | MCP-046 |
| TRC-047 | FILE-047 | REF-047 | MCP-047 |
| TRC-048 | FILE-048 | REF-048 | MCP-048 |
| TRC-049 | FILE-049 | REF-049 | MCP-049 |
| TRC-050 | FILE-050 | REF-050 | MCP-050 |
| TRC-051 | FILE-051 | REF-051 | MCP-051 |
| TRC-052 | FILE-052 | REF-052 | MCP-052 |
| TRC-053 | FILE-053 | REF-053 | MCP-053 |
| TRC-054 | FILE-054 | REF-054 | MCP-054 |
| TRC-055 | FILE-055 | REF-055 | MCP-055 |
| TRC-056 | FILE-056 | REF-056 | MCP-056 |
| TRC-057 | FILE-057 | REF-057 | MCP-057 |
| TRC-058 | FILE-058 | REF-058 | MCP-058 |
| TRC-059 | FILE-059 | REF-059 | MCP-059 |
| TRC-060 | FILE-060 | REF-060 | MCP-060 |
| TRC-061 | FILE-061 | REF-061 | MCP-061 |
| TRC-062 | FILE-062 | REF-062 | MCP-062 |
| TRC-063 | FILE-063 | REF-063 | MCP-063 |
| TRC-064 | FILE-064 | REF-064 | MCP-064 |
| TRC-065 | FILE-065 | REF-065 | MCP-065 |
| TRC-066 | FILE-066 | REF-066 | MCP-066 |
| TRC-067 | FILE-067 | REF-067 | MCP-067 |
| TRC-068 | FILE-068 | REF-068 | MCP-068 |
| TRC-069 | FILE-069 | REF-069 | MCP-069 |
| TRC-070 | FILE-070 | REF-070 | MCP-070 |
| TRC-071 | FILE-071 | REF-071 | Exception: signer or prompt |
| TRC-072 | FILE-072 | REF-072 | Exception: signer or prompt |
| TRC-073 | FILE-073 | REF-073 | Exception: signer or prompt |
| TRC-074 | FILE-074 | REF-074 | Exception: signer or prompt |
| TRC-075 | FILE-075 | REF-075 | Exception: signer or prompt |
| TRC-076 | FILE-076 | REF-076 | Exception: signer or prompt |
| TRC-077 | FILE-077 | REF-077 | Exception: signer or prompt |
| TRC-078 | FILE-078 | REF-078 | Exception: signer or prompt |
| TRC-079 | FILE-079 | REF-079 | Exception: signer or prompt |
| TRC-080 | FILE-080 | REF-080 | MCP-071 |
| TRC-081 | FILE-081 | REF-081 | MCP-072 |
| TRC-082 | FILE-082 | REF-082 | MCP-073 |
| TRC-083 | FILE-083 | REF-083 | MCP-074 |
| TRC-084 | FILE-084 | REF-084 | MCP-075 |
| TRC-085 | FILE-085 | REF-085 | MCP-076 |
| TRC-086 | FILE-086 | REF-086 | MCP-077 |
| TRC-087 | FILE-087 | REF-087 | MCP-078 |
| TRC-088 | FILE-088 | REF-088 | MCP-079 |
| TRC-089 | FILE-089 | REF-089 | MCP-080 |
| TRC-090 | FILE-090 | REF-090 | MCP-081 |
| TRC-091 | FILE-091 | REF-091 | MCP-082 |
| TRC-092 | FILE-092 | REF-092 | MCP-083 |
| TRC-093 | FILE-093 | REF-093 | MCP-084 |
| TRC-094 | FILE-094 | REF-094 | MCP-085 |
| TRC-095 | FILE-095 | REF-095 | MCP-086 |
| TRC-096 | FILE-096 | REF-096 | MCP-087 |
| TRC-097 | FILE-097 | REF-097 | MCP-088 |
| TRC-098 | FILE-098 | REF-098 | MCP-089 |
| TRC-099 | FILE-099 | REF-099 | MCP-090 |
| TRC-100 | FILE-100 | REF-100 | MCP-091 |
| TRC-101 | FILE-101 | REF-101 | MCP-092 |
| TRC-102 | FILE-102 | REF-102 | MCP-093 |
| TRC-103 | FILE-103 | REF-103 | MCP-094 |
| TRC-104 | FILE-104 | REF-104 | MCP-095 |
| TRC-105 | FILE-105 | REF-105 | MCP-096 |
| TRC-106 | FILE-106 | REF-106 | MCP-097 |
| TRC-107 | FILE-107 | REF-107 | MCP-098 |
| TRC-108 | FILE-108 | REF-108 | MCP-099 |
| TRC-109 | FILE-109 | REF-109 | MCP-100 |
| TRC-110 | FILE-110 | REF-110 | MCP-101 |
| TRC-111 | FILE-111 | REF-111 | MCP-102 |
| TRC-112 | FILE-112 | REF-112 | MCP-103 |
| TRC-113 | FILE-113 | REF-113 | MCP-104 |
| TRC-114 | FILE-114 | REF-114 | MCP-105 |
| TRC-115 | FILE-115 | REF-115 | MCP-106 |
| TRC-116 | FILE-116 | REF-116 | MCP-107 |
| TRC-117 | FILE-117 | REF-117 | MCP-108 |
| TRC-118 | FILE-118 | REF-118 | MCP-109 |
| TRC-119 | FILE-119 | REF-119 | MCP-110 |
| TRC-120 | FILE-120 | REF-120 | MCP-111 |
| TRC-121 | FILE-121 | REF-121 | MCP-112 |
| TRC-122 | FILE-122 | REF-122 | MCP-113 |
| TRC-123 | FILE-123 | REF-123 | MCP-114 |
| TRC-124 | FILE-124 | REF-124 | MCP-115 |
| TRC-125 | FILE-125 | REF-125 | MCP-116 |
| TRC-126 | FILE-126 | REF-126 | MCP-117 |
| TRC-127 | FILE-127 | REF-127 | MCP-118 |
| TRC-128 | FILE-128 | REF-128 | MCP-119 |
| TRC-129 | FILE-129 | REF-129 | MCP-120 |
| TRC-130 | FILE-130 | REF-130 | MCP-121 |
| TRC-131 | FILE-131 | REF-131 | MCP-122 |
| TRC-132 | FILE-132 | REF-132 | MCP-123 |
| TRC-133 | FILE-133 | REF-133 | MCP-124 |
| TRC-134 | FILE-134 | REF-134 | MCP-125 |
| TRC-135 | FILE-135 | REF-135 | MCP-126 |
| TRC-136 | FILE-136 | REF-136 | MCP-127 |
| TRC-137 | FILE-137 | REF-137 | MCP-128 |
| TRC-138 | FILE-138 | REF-138 | MCP-129 |
| TRC-139 | FILE-139 | REF-139 | MCP-130 |
| TRC-140 | FILE-140 | REF-140 | MCP-131 |
| TRC-141 | FILE-141 | REF-141 | MCP-132 |
| TRC-142 | FILE-142 | REF-142 | MCP-133 |
| TRC-143 | FILE-143 | REF-143 | MCP-134 |
| TRC-144 | FILE-144 | REF-144 | MCP-135 |
| TRC-145 | FILE-145 | REF-145 | MCP-136 |
| TRC-146 | FILE-146 | REF-146 | MCP-137 |
| TRC-147 | FILE-147 | REF-147 | MCP-138 |
| TRC-148 | FILE-148 | REF-148 | MCP-139 |
| TRC-149 | FILE-149 | REF-149 | MCP-140 |
| TRC-150 | FILE-150 | REF-150 | MCP-141 |
| TRC-151 | FILE-151 | REF-151 | MCP-142 |
| TRC-152 | FILE-152 | REF-152 | MCP-143 |
| TRC-153 | FILE-153 | REF-153 | MCP-144 |
| TRC-154 | FILE-154 | REF-154 | MCP-145 |
| TRC-155 | FILE-155 | REF-155 | MCP-146 |
| TRC-156 | FILE-156 | REF-156 | MCP-147 |
| TRC-157 | FILE-157 | REF-157 | MCP-148 |
| TRC-158 | FILE-158 | REF-158 | MCP-149 |
| TRC-159 | FILE-159 | REF-159 | MCP-150 |
| TRC-160 | FILE-160 | REF-160 | MCP-151 |
| TRC-161 | FILE-161 | REF-161 | MCP-152 |
| TRC-162 | FILE-162 | REF-162 | MCP-153 |
| TRC-163 | FILE-163 | REF-163 | MCP-154 |
| TRC-164 | FILE-164 | REF-164 | MCP-155 |
| TRC-165 | FILE-165 | REF-165 | MCP-156 |
| TRC-166 | FILE-166 | REF-166 | MCP-157 |
| TRC-167 | FILE-167 | REF-167 | MCP-158 |
| TRC-168 | FILE-168 | REF-168 | MCP-159 |
| TRC-169 | FILE-169 | REF-169 | MCP-160 |
| TRC-170 | FILE-170 | REF-170 | MCP-161 |
| TRC-171 | FILE-171 | REF-171 | MCP-162 |
| TRC-172 | FILE-172 | REF-172 | MCP-163 |
| TRC-173 | FILE-173 | REF-173 | MCP-164 |
| TRC-174 | FILE-174 | REF-174 | MCP-165 |
| TRC-175 | FILE-175 | REF-175 | MCP-166 |
| TRC-176 | FILE-176 | REF-176 | MCP-167 |
| TRC-177 | FILE-177 | REF-177 | MCP-168 |
| TRC-178 | FILE-178 | REF-178 | MCP-169 |
| TRC-179 | FILE-179 | REF-179 | MCP-170 |
| TRC-180 | FILE-180 | REF-180 | MCP-171 |
| TRC-181 | FILE-181 | REF-181 | MCP-172 |
| TRC-182 | FILE-182 | REF-182 | MCP-173 |
| TRC-183 | FILE-183 | REF-183 | MCP-174 |
| TRC-184 | FILE-184 | REF-184 | MCP-175 |
| TRC-185 | FILE-185 | REF-185 | MCP-176 |
| TRC-186 | FILE-186 | REF-186 | MCP-177 |
| TRC-187 | FILE-187 | REF-187 | MCP-178 |
| TRC-188 | FILE-188 | REF-188 | MCP-179 |
| TRC-189 | FILE-189 | REF-189 | MCP-180 |
| TRC-190 | FILE-190 | REF-190 | MCP-181 |
| TRC-191 | FILE-191 | REF-191 | MCP-182 |
| TRC-192 | FILE-192 | REF-192 | MCP-183 |
| TRC-193 | FILE-193 | REF-193 | MCP-184 |
| TRC-194 | FILE-194 | REF-194 | MCP-185 |
| TRC-195 | FILE-195 | REF-195 | MCP-186 |
| TRC-196 | FILE-196 | REF-196 | MCP-187 |
| TRC-197 | FILE-197 | REF-197 | MCP-188 |
| TRC-198 | FILE-198 | REF-198 | MCP-189 |
| TRC-199 | FILE-199 | REF-199 | MCP-190 |
| TRC-200 | FILE-200 | REF-200 | MCP-191 |
| TRC-201 | FILE-201 | REF-201 | MCP-192 |
| TRC-202 | FILE-202 | REF-202 | MCP-193 |
| TRC-203 | FILE-203 | REF-203 | MCP-194 |
| TRC-204 | FILE-204 | REF-204 | MCP-195 |
| TRC-205 | FILE-205 | REF-205 | MCP-196 |
| TRC-206 | FILE-206 | REF-206 | MCP-197 |
| TRC-207 | FILE-207 | REF-207 | MCP-198 |
| TRC-208 | FILE-208 | REF-208 | MCP-199 |
| TRC-209 | FILE-209 | REF-209 | Exception: signer or prompt |
| TRC-210 | FILE-210 | REF-210 | Exception: signer or prompt |
| TRC-211 | FILE-211 | REF-211 | Exception: signer or prompt |
| TRC-212 | FILE-212 | REF-212 | Exception: signer or prompt |
| TRC-213 | FILE-213 | REF-213 | MCP-200 |
| TRC-214 | FILE-214 | REF-214 | MCP-201 |
| TRC-215 | FILE-215 | REF-215 | MCP-202 |
| TRC-216 | FILE-216 | REF-216 | MCP-203 |
| TRC-217 | FILE-217 | REF-217 | MCP-204 |
| TRC-218 | FILE-218 | REF-218 | MCP-205 |
| TRC-219 | FILE-219 | REF-219 | MCP-206 |
| TRC-220 | FILE-220 | REF-220 | MCP-207 |
| TRC-221 | FILE-221 | REF-221 | MCP-208 |
| TRC-222 | FILE-222 | REF-222 | MCP-209 |
| TRC-223 | FILE-223 | REF-223 | MCP-210 |
| TRC-224 | FILE-224 | REF-224 | MCP-211 |
| TRC-225 | FILE-225 | REF-225 | MCP-212 |
| TRC-226 | FILE-226 | REF-226 | MCP-213 |
| TRC-227 | FILE-227 | REF-227 | MCP-214 |
| TRC-228 | FILE-228 | REF-228 | MCP-215 |
| TRC-229 | FILE-229 | REF-229 | MCP-216 |
| TRC-230 | FILE-230 | REF-230 | MCP-217 |
| TRC-231 | FILE-231 | REF-231 | MCP-218 |
| TRC-232 | FILE-232 | REF-232 | MCP-219 |
| TRC-233 | FILE-233 | REF-233 | MCP-220 |
| TRC-234 | FILE-234 | REF-234 | MCP-221 |
| TRC-235 | FILE-235 | REF-235 | MCP-222 |
| TRC-236 | FILE-236 | REF-236 | MCP-223 |
| TRC-237 | FILE-237 | REF-237 | MCP-224 |
| TRC-238 | FILE-238 | REF-238 | MCP-225 |
| TRC-239 | FILE-239 | REF-239 | MCP-226 |
| TRC-240 | FILE-240 | REF-240 | MCP-227 |
| TRC-241 | FILE-241 | REF-241 | MCP-228 |
| TRC-242 | FILE-242 | REF-242 | MCP-229 |
| TRC-243 | FILE-243 | REF-243 | MCP-230 |
| TRC-244 | FILE-244 | REF-244 | MCP-231 |
| TRC-245 | FILE-245 | REF-245 | MCP-232 |
| TRC-246 | FILE-246 | REF-246 | MCP-233 |
| TRC-247 | FILE-247 | REF-247 | MCP-234 |
| TRC-248 | FILE-248 | REF-248 | MCP-235 |
| TRC-249 | FILE-249 | REF-249 | MCP-236 |
| TRC-250 | FILE-250 | REF-250 | MCP-237 |
| TRC-251 | FILE-251 | REF-251 | MCP-238 |
| TRC-252 | FILE-252 | REF-252 | MCP-239 |
| TRC-253 | FILE-253 | REF-253 | MCP-240 |
| TRC-254 | FILE-254 | REF-254 | MCP-241 |
| TRC-255 | FILE-255 | REF-255 | MCP-242 |
| TRC-256 | FILE-256 | REF-256 | MCP-243 |
| TRC-257 | FILE-257 | REF-257 | MCP-244 |
| TRC-258 | FILE-258 | REF-258 | MCP-245 |
| TRC-259 | FILE-259 | REF-259 | MCP-246 |
| TRC-260 | FILE-260 | REF-260 | MCP-247 |
| TRC-261 | FILE-261 | REF-261 | MCP-248 |
| TRC-262 | FILE-262 | REF-262 | MCP-249 |
| TRC-263 | FILE-263 | REF-263 | MCP-250 |
| TRC-264 | FILE-264 | REF-264 | MCP-251 |
| TRC-265 | FILE-265 | REF-265 | MCP-252 |
| TRC-266 | FILE-266 | REF-266 | MCP-253 |
| TRC-267 | FILE-267 | REF-267 | MCP-254 |
| TRC-268 | FILE-268 | REF-268 | MCP-255 |
| TRC-269 | FILE-269 | REF-269 | MCP-256 |
| TRC-270 | FILE-270 | REF-270 | MCP-257 |
| TRC-271 | FILE-271 | REF-271 | MCP-258 |
| TRC-272 | FILE-272 | REF-272 | MCP-259 |
| TRC-273 | FILE-273 | REF-273 | MCP-260 |
| TRC-274 | FILE-274 | REF-274 | MCP-261 |
| TRC-275 | FILE-275 | REF-275 | MCP-262 |
| TRC-276 | FILE-276 | REF-276 | MCP-263 |
| TRC-277 | FILE-277 | REF-277 | MCP-264 |
| TRC-278 | FILE-278 | REF-278 | MCP-265 |
| TRC-279 | FILE-279 | REF-279 | MCP-266 |
| TRC-280 | FILE-280 | REF-280 | MCP-267 |
| TRC-281 | FILE-281 | REF-281 | MCP-268 |
| TRC-282 | FILE-282 | REF-282 | MCP-269 |
| TRC-283 | FILE-283 | REF-283 | MCP-270 |
| TRC-284 | FILE-284 | REF-284 | MCP-271 |
| TRC-285 | FILE-285 | REF-285 | MCP-272 |
| TRC-286 | FILE-127 | CTL-001 | MCP-273 |
| TRC-287 | FILE-127 | CTL-002 | MCP-274 |
| TRC-288 | FILE-127 | CTL-003 | MCP-275 |
| TRC-289 | FILE-127 | CTL-004 | MCP-276 |
| TRC-290 | FILE-127 | CTL-005 | MCP-277 |
| TRC-291 | FILE-127 | CTL-006 | MCP-278 |
| TRC-292 | FILE-124 | CTL-007 | MCP-279 |
| TRC-293 | FILE-127 | CTL-008 | MCP-280 |
| TRC-294 | FILE-142 | CTL-009 | MCP-281 |
| TRC-295 | FILE-124 | CTL-010 | MCP-282 |
| TRC-296 | FILE-124 | CTL-011 | MCP-283 |
| TRC-297 | FILE-124 | CTL-012 | MCP-284 |
| TRC-298 | FILE-126 | CTL-013 | MCP-285 |
| TRC-299 | FILE-126 | CTL-014 | MCP-286 |
| TRC-300 | FILE-142 | CTL-015 | MCP-287 |
| TRC-301 | FILE-142 | CTL-016 | MCP-288 |
| TRC-302 | FILE-126 | CTL-017 | MCP-289 |
| TRC-303 | FILE-126 | CTL-018 | MCP-290 |
| TRC-304 | FILE-124 | CTL-019 | MCP-291 |
| TRC-305 | FILE-124 | CTL-020 | MCP-292 |
| TRC-306 | FILE-124 | CTL-021 | MCP-293 |
| TRC-307 | FILE-124 | CTL-022 | MCP-294 |
| TRC-308 | FILE-124 | CTL-023 | MCP-295 |
| TRC-309 | FILE-126 | CTL-024 | MCP-296 |
| TRC-310 | FILE-126 | CTL-025 | MCP-297 |
| TRC-311 | FILE-126 | CTL-026 | MCP-298 |
| TRC-312 | FILE-126 | CTL-027 | MCP-299 |
| TRC-313 | FILE-126 | CTL-028 | MCP-300 |
| TRC-314 | FILE-142 | CTL-029 | MCP-301 |
| TRC-315 | FILE-126 | CTL-030 | MCP-302 |
| TRC-316 | FILE-126 | CTL-031 | MCP-303 |
| TRC-317 | FILE-124 | CTL-032 | MCP-304 |
| TRC-318 | FILE-126 | CTL-033 | MCP-305 |
| TRC-319 | FILE-124 | CTL-034 | MCP-306 |
| TRC-320 | FILE-124 | CTL-035 | MCP-307 |
| TRC-321 | FILE-126 | CTL-036 | MCP-308 |
| TRC-322 | FILE-126 | CTL-037 | MCP-309 |
| TRC-323 | FILE-126 | CTL-038 | MCP-310 |
| TRC-324 | FILE-126 | CTL-039 | MCP-311 |
| TRC-325 | FILE-124 | CTL-040 | MCP-312 |
| TRC-326 | FILE-126 | CTL-041 | MCP-313 |
| TRC-327 | FILE-130 | CTL-042 | MCP-314 |
| TRC-328 | FILE-126 | CTL-043 | MCP-315 |
| TRC-329 | FILE-132 | CTL-044 | MCP-316 |
| TRC-330 | FILE-124 | CTL-045 | MCP-317 |
| TRC-331 | FILE-124 | CTL-046 | MCP-318 |
| TRC-332 | FILE-124 | CTL-047 | MCP-319 |
| TRC-333 | FILE-124 | CTL-048 | MCP-320 |
| TRC-334 | FILE-126 | CTL-049 | MCP-321 |
| TRC-335 | FILE-124 | CTL-050 | MCP-322 |
| TRC-336 | FILE-124 | CTL-051 | MCP-323 |
| TRC-337 | FILE-124 | CTL-052 | MCP-324 |
| TRC-338 | FILE-124 | CTL-053 | MCP-325 |
| TRC-339 | FILE-124 | CTL-054 | MCP-326 |
| TRC-340 | FILE-130 | CTL-055 | MCP-327 |
| TRC-341 | FILE-130 | CTL-056 | MCP-328 |
| TRC-342 | FILE-130 | CTL-057 | MCP-329 |
| TRC-343 | FILE-130 | CTL-058 | MCP-330 |
| TRC-344 | FILE-130 | CTL-059 | MCP-331 |
| TRC-345 | FILE-130 | CTL-060 | MCP-332 |
| TRC-346 | FILE-130 | CTL-061 | MCP-333 |
| TRC-347 | FILE-130 | CTL-062 | MCP-334 |
| TRC-348 | FILE-130 | CTL-063 | Exception: loopback-only infrastructure probe |
| TRC-349 | FILE-107 | CTL-064 | MCP-335 |
| TRC-350 | FILE-107 | CTL-065 | MCP-336 |
| TRC-351 | FILE-107 | CTL-066 | MCP-337 |
| TRC-352 | FILE-118 | CTL-067 | MCP-338 |
| TRC-353 | FILE-118 | CTL-068 | MCP-339 |
| TRC-354 | FILE-119 | CTL-069 | MCP-340 |
| TRC-355 | FILE-120 | CTL-070 | MCP-341 |
| TRC-356 | FILE-120 | CTL-071 | MCP-342 |
| TRC-357 | FILE-011 | CTL-072 | MCP-343 |
| TRC-358 | FILE-135 | CTL-073 | MCP-344 |
| TRC-359 | FILE-138 | CTL-074 | MCP-345 |
| TRC-360 | FILE-153 | CTL-075 | MCP-346 |
| TRC-361 | FILE-205 | CTL-076 | MCP-347 |
| TRC-362 | FILE-155 | CTL-077 | MCP-348 |
| TRC-363 | FILE-158 | CTL-078 | MCP-349 |
| TRC-364 | FILE-162 | CTL-079 | MCP-350 |
| TRC-365 | FILE-207 | CTL-080 | MCP-351 |
| TRC-366 | FILE-126 | CTL-081 | MCP-352 |
| TRC-367 | FILE-126 | CTL-082 | MCP-353 |
| TRC-368 | FILE-126 | CTL-083 | MCP-354 |
| TRC-369 | FILE-126 | CTL-084 | MCP-355 |
| TRC-370 | FILE-124 | CTL-085 | MCP-356 |
| TRC-371 | FILE-126 | CTL-086 | MCP-357 |
| TRC-372 | FILE-126 | CTL-087 | MCP-358 |
| TRC-373 | FILE-124 | CTL-088 | MCP-359 |
| TRC-374 | FILE-140 | CTL-089 | MCP-360 |
| TRC-375 | FILE-119 | CTL-090 | MCP-361 |
| TRC-376 | FILE-162 | CTL-091 | MCP-362 |
| TRC-377 | FILE-135 | CTL-092 | MCP-363 |
| TRC-378 | FILE-095 | CTL-093 | MCP-364 |
| TRC-379 | FILE-097 | CTL-094 | MCP-365 |
| TRC-380 | FILE-082 | CTL-095 | MCP-366 |
| TRC-381 | FILE-090 | CTL-096 | MCP-367 |
| TRC-382 | FILE-081 | CTL-097 | MCP-368 |
| TRC-383 | FILE-087 | CTL-098 | MCP-369 |
| TRC-384 | FILE-194 | CTL-099 | MCP-370 |
| TRC-385 | FILE-196 | CTL-100 | MCP-371 |
| TRC-386 | FILE-197 | CTL-101 | MCP-372 |
| TRC-387 | FILE-198 | CTL-102 | MCP-373 |
| TRC-388 | FILE-201 | CTL-103 | MCP-374 |

## Approval

Approve Table 5 and the explicit exceptions before implementing reflection, runtime controls, API logging or MCP publication. The proposed read surface and write capabilities require integration tests against the pinned frontend and backend contracts.
