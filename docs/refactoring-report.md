# Architecture compliance and refactoring report

## Scope

The clean starting branch was `strategy/early-momentum-reversal` at `6024484b415169e0ce83f52edf939c3794727139`. Its tree matched GitHub `main` at `0cbae62b390e0fd430efe4f0ee995334c50948b1` at the time of inspection. The local branch was retained as the source of truth. The [architecture audit](architecture-audit.md) describes the runtime and dependency boundaries. The [findings and plan](refactoring-plan.md) classify risks and list recommendations that require separate authorization.

## Production changes

| Change | Before | After and preserved behavior | Focused validation |
| --- | --- | --- | --- |
| [Startup replay](../src/index.ts#L67) | Position, equity and Recon rejection replay was embedded in dependency composition. | `restoreTradingState` holds the same loop in the worker entry point. It preserves record order, parsing behavior, journal writes, readiness timing, and paper/live selection. The helper accepts a read-only view of input events and mutates the existing owners. | 10 tests passed covering the executable worker, logger, architecture, paper concurrency and entry authorization. The new seeded restart test also passed before extraction. |
| [Control admission](../src/control/worker.ts#L14) | A nested conditional selected a rejection reason in the middle of durable command processing. | A private module-level command query uses typed action narrowing and explicit guards. Reason strings, validation behavior, journal writes, acknowledgement order and controls applied after a successful receipt remain the same. | 20 tests passed covering command processing, dashboard control, mode changes, safety and architecture. |
| [Trade history](../src/logging/projections/trade-history.ts#L11) | Matching scanner triggers, fills and closes was interleaved with row arithmetic and transaction metadata selection. The normalized close identity was computed repeatedly. | The projection loop owns ordering, matching and cleanup. A private function builds the row. The loop reuses the matched identity. Formulas, rounding, receipt parsing, trigger attribution and sort order remain the same. | 15 tests passed covering history, API, entity reads, live intent, live view and architecture. |

Each increment passed `npm run build` and `npm run lint`, the relevant tests and the original-artifact diff. There are no new packages, production modules or exports.

## Architecture and contracts

The before and after TypeScript source graphs are identical. The scan covers 178 tracked files under `src/` and `schemas/`, 668 unique local static import and re-export edges, 487 edges after excluding declaration-level type-only edges, and zero cycles in either graph. The graph is file-based and excludes dynamic imports on disk and process-level relationships. The existing architecture tests also passed. Dependency directions, ownership, composition roots and extension points are unchanged.

Production TypeScript declaration emit is byte-for-byte identical between revisions. Public schemas, prompts, configuration and workflows were outside the edit scope. The change introduced no strategy, risk, signer, shutdown, security, precision or persistence policy change. The production entry-point executable was tested in paper with fixture responses and a temporary journal. Runtime behavior beyond that fixture remains limited by the available validation environment.

## Test integrity and quality comparison

The protected manifest includes 108 original files under `tests/`, `fixtures/`, `prompts/` and `docs/prompts/`, and the package manifests, TypeScript configuration and GitHub workflows. Its SHA-256 is `b2e0a03d1dde8ddd55bc8e2ce8736315e9841999e1d23adb2443dd837c9012e7`. Each final working-tree file was compared to the original Git blob hash. [The added test](../tests/integration/worker-state-restore.test.ts) uses a temporary, seeded paper journal with one open and one closed position and checks that replay precedes readiness.

Validation used Node v24.22.3 and npm 11.19.1 with the locked dependencies already installed. Before publication, the final tree also passed build, lint, all 176 tests, all six simulations, and production JavaScript emit on the CI-pinned Node v20.19.6. The benchmark and coverage comparisons below use Node v24.22.3. npm printed an existing unknown proxy-config warning and exited successfully.

| Check | Baseline | Refactored |
| --- | --- | --- |
| `npm test` | 175 original tests passed | 176 passed, comprising 175 original tests and 1 new test |
| `npm run simulate` | 6 passed | 6 passed |
| `npm run lint` and `npm run build` | Pass | Pass |
| Production JavaScript emit | Pass | Pass |
| Production declaration emit | Reference | Byte-for-byte match |
| Harness policy, deploy shell syntax and deploy timing | Pass | Pass |
| REST and MCP route inventory | Reference | Identical command output. Existing inventory drift remains. |
| Static file import cycles | 0 | 0 |
| Original tests, fixtures, snapshots and configuration | Baseline blobs recorded | 108 protected blobs matched |

A separate Node coverage run executed the 175 original tests on each revision, with the same `src/**/*.ts` filter and the new test excluded. Both runs passed. Among files reported by Node, line coverage was 93.48% → 93.42%, branch coverage was 78.42% → 78.15%, and function coverage was 86.27% → 86.30%. The refactors changed the executable line, branch and function counts. These percentages do not demonstrate a loss or gain of covered trading behavior. No coverage threshold changed.

The following AST branch scores start at one per function. They count conditionals, loops, catches, cases, ternaries and short-circuit logical operators in the function body. Nested callables are excluded and extracted helpers are listed separately. The scores measure how much branching a reader encounters in each function. They do not imply that the underlying business rules became simpler.

| Function | Before lines / score | After lines / score |
| --- | ---: | ---: |
| Worker `run` | 135 / 65 | 109 / 42 |
| `restoreTradingState` | Inlined | 29 / 24 |
| `WorkerControls.drain` | 29 / 25 | 25 / 16 |
| `commandGap` | Inlined | 11 / 9 |
| `projectTradeDetails` | 29 / 17 | 25 / 14 |
| `tradeHistoryRow` | Inlined | 15 / 4 |

A single matched close key replaces repeated normalization. No project-wide duplication or standardized cognitive complexity analyzer was run. TypeScript remains strict and the existing lint script is a TypeScript check. No linter rule or compiler option changed.

## Performance and verification limits

Both revisions ran on Node v24.22.3 in consecutive processes with the same lockfile dependencies. The candidate benchmark uses the repository's [benchmark script](../scripts/benchmark-candidate.ts), 100 warm-ups and 3,000 deterministic fixture candidates. Reproduce from a checkout with `LOG_LEVEL=silent npm run bench:candidate -- PATH_TO_CHECKOUT 3000`. The projection benchmark warms up five times and measures 20 projections over a prebuilt array of 3,000 matched paper fills and closes. Each measured run checks the row count and realized profit. Synthetic fixtures omit external network requests, chain confirmation and durable journal I/O.

| Measurement | Baseline | Refactored |
| --- | ---: | ---: |
| Candidates per second | 805 | 817 |
| Candidate p50 / p95 / p99 | 0.773 / 2.111 / 9.170 ms | 0.751 / 2.133 / 8.731 ms |
| Candidate CPU / terminal RSS | 7.04 s / 433 MiB | 6.95 s / 427 MiB |
| Projection p50 / p95 per 3,000 closed trades | 55.03 / 64.80 ms | 53.39 / 65.31 ms |

The measurements moved in both directions. No performance or scalability improvement is established by this run.

Docker was unavailable. Production TypeScript emit exercises the Docker build command's compile step. Deployment validation was limited to workflow and shell inspection, route inventory, existing fixtures and deploy timing tests. No live service, credentials, wallet broadcast, remote provider, production data or deployment was used. The [prioritized recommendations](refactoring-plan.md) distinguish deferred scope from verified findings.
