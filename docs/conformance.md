# Prompt conformance and verification

The reference revision is `e61c09863873a54f7839e1378f7770e25191d517`.
Five approved changes affect four prompt files. Scanner, Rug Check, Executor
and Logger use their original wording. All agents load their named prompt.

| Agent | Clauses exercised or enforced | Implementation |
| --- | --- | --- |
| Recon A | Mode-specific tool calls, observed identity and numbers, min/max age, minimum volume and liquidity, deduplication, per-source errors and public array | `src/agents/recon-a.ts:9`, `src/tools/recon-evidence.ts:84` |
| Recon B | Chain-bound tools, nullable required keys, binary flags, conservative honeypot conflict, provenance, confidence and unavailable evidence | `src/agents/recon-b.ts:10`, `src/tools/recon-evidence.ts:23`, `schemas/recon-checks.ts:17` |
| Recon C | Optional configured actions, token and source binding, array, unavailable score and measured zero | `src/agents/recon-c.ts:7`, `src/tools/social.ts` |
| Scanner | Required caller thresholds, empty feed, seen tokens, ratio then liquidity, rank limit, exact row identity and bare array | `src/agents/scanner.ts:13`, `src/orchestrator/loop.ts:23` |
| Rug Check | Scanner row plus raw evidence, boolean conversion, safety thresholds, ambiguous critical failure, non-critical missing note, permanent worker rejection | `schemas/recon-checks.ts:17`, `src/agents/rug-check.ts:11`, `src/cache/recon-cache.ts`, `src/index.ts` |
| Sizer | Ordered refusals, drawdown halt, haircut, depth cap, gas, optional price, null equity and age, identity and numeric output | `src/agents/sizer.ts:19`, `schemas/sizer.ts` |
| Executor | Entry and exit, stop/take-profit/timeout, slippage, quote errors, one terminal result, size and paper fill binding | `src/agents/executor.ts:11`, `src/orchestrator/pipeline.ts:39`, `src/exits/watcher.ts` |
| Logger | Single/batch envelopes, one row per hop, exact object preservation, per-agent gaps, current row timestamps and malformed marker | `src/agents/logger.ts:22`, `src/logging/logger.ts` |
| Equity Curve | Chronologically ordered close arithmetic, peak drawdown, expectancy, wins, empty history, agent publication time and Sizer handoff | `src/agents/equity-curve.ts:6`, `src/orchestrator/pipeline.ts:39`, `src/dashboard-api/routes.ts` |

## Contract revision test results

Node 20.20.2 ran the build, complete suite and standalone simulation.
Each agent has a focused unit file in `tests/unit/`. The simulation in
`tests/integration/simulation.test.ts` mocks the HTTP boundaries and exercises
the production agent wrappers. It repeats a paper run with identical inputs,
clock and model responses and compares audit events.

| Command | Exit | Observed result |
| --- | ---: | --- |
| `npm run build` | 0 | TypeScript passed |
| `LOG_LEVEL=silent npm test` | 0 | 60 passed, 0 failed, 0 skipped |
| `LOG_LEVEL=silent npm run simulate` | 0 | 6 passed, 0 failed, 0 skipped |
| `git diff --check` | 0 | No whitespace errors |
| `test ! -e prompts/runtime` | 0 | No parallel prompt directory |
| `node --import tsx --test --test-name-pattern="reviewed prompt" tests/unit/scanner.test.ts` | 1, expected | Isolated mutation reversed the liquidity tiebreak. The reviewed-prompt assertion failed. |
| `node --import tsx --test --test-name-pattern="reviewed prompt" tests/unit/executor.test.ts` | 1, expected | Isolated mutation renamed fill_price. The reviewed-prompt assertion failed. |

The successful simulation starts with $1,000, sizes at $20 and admits $10
under the 1% position limit. It leaves $990 in uncommitted cash, records
one position and five Logger rows, and publishes $1,000 realized equity.
Five further scenarios skip a filtered candidate, fail missing mint evidence,
refuse stale equity, halt on drawdown and abort excessive slippage.
The separate six-agent contract test closes trades at +$10 and −$4 and
expects $1,006 equity, two closes and a 0.5 win rate.

## Residual gaps

- **Live integrations.** Tests use mocked Responses replies and HTTP fixtures.
  They cannot establish live model compliance, provider quotas, credential
  access or network latency. The table above records verification at the original contract revision.
- **Security coverage.** Provider evidence is limited to identifiable source
  fields. Etherscan creation metadata alone cannot establish a deployer's
  previous rugs. That value stays null. A missing critical flag prevents entry.
  Optional Bubblemaps and Telegram have no built-in adapters. The default
  social adapters require configured X or Reddit access.
- **Model-dependent clauses.** The code checks social source availability,
  score range and support for zero. Classification, account interpretation,
  narrative scoring and the bot-heavy adjustment still rely on the model.
  The tests do not independently verify those judgments against a labeled
  social dataset. Sizer's numeric result is checked independently. Its
  free-form explanation is checked for numeric content, not mathematical
  equivalence of every statement in the text.
- **Paper assumptions.** The worker uses reported price and defaults to zero
  gas and expected slippage. A paper snapshot may supply expected slippage.
  Permanent rejection
  across restarts requires the continuous worker's persistent journal.
  The offline simulation provides no evidence about real fills or P&L.
- **Coverage boundaries.** Mocked replay verifies application behavior with
  fixed responses. Prompt hash checks detect textual mutations, including
  harmless wording changes. They do not prove identical live language-model
  responses. External tool errors, interruptions, and market conditions have
  more combinations than the fixture suite covers.

## Exact approved prompt diff

Generated against the pinned main commit with zero context.

```diff
diff --git a/prompts/equity-curve.md b/prompts/equity-curve.md
index 9049bfd..96e922b 100644
--- a/prompts/equity-curve.md
+++ b/prompts/equity-curve.md
@@ -26 +26 @@ RULES:
-- Deterministic. Same inputs → same output.
+- For identical inputs, all output fields except `as_of` are deterministic.
diff --git a/prompts/recon-b-onchain.md b/prompts/recon-b-onchain.md
index ebd1037..534c21a 100644
--- a/prompts/recon-b-onchain.md
+++ b/prompts/recon-b-onchain.md
@@ -38,10 +38,10 @@ OUTPUT (one object, no prose):
-    "renounced": b,
-    "mint_auth_disabled": b,
-    "freeze_auth_disabled": b,
-    "lp_locked_or_burned": b,
-    "honeypot_sim_ok": b,
-    "tax_bps": n,
-    "blacklist_present": b,
-    "deployer_rugged_before": b|null,
-    "holder_top10_pct": n,
-    "holder_count": n },
+    "renounced": n|null,
+    "mint_auth_disabled": n|null,
+    "freeze_auth_disabled": n|null,
+    "lp_locked_or_burned": n|null,
+    "honeypot_sim_ok": n|null,
+    "tax_bps": n|null,
+    "blacklist_present": n|null,
+    "deployer_rugged_before": n|null,
+    "holder_top10_pct": n|null,
+    "holder_count": n|null },
diff --git a/prompts/recon-c-social.md b/prompts/recon-c-social.md
index 0fe57b5..28d2afe 100644
--- a/prompts/recon-c-social.md
+++ b/prompts/recon-c-social.md
@@ -39 +39 @@ OUTPUT (array):
-    "social_score": n, "sources":["x","reddit","telegram"],
+    "social_score": n|null, "sources":["x","reddit","telegram"],
diff --git a/prompts/sizer.md b/prompts/sizer.md
index 4b66a40..904cdd6 100644
--- a/prompts/sizer.md
+++ b/prompts/sizer.md
@@ -30 +30 @@ BEHAVIOR — steps in order:
-9. size_tokens = size_usd / reference_price (if provided; else omit).
+9. size_tokens = size_usd / reference_price (if provided; else set size_tokens to null).
@@ -37,2 +37,2 @@ OUTPUT (one object, no prose):
-  "max_slippage_bps":n, "equity_at_decision":n,
-  "equity_age_sec":n, "risk_pct_used":n,
+  "max_slippage_bps":n, "equity_at_decision":n|null,
+  "equity_age_sec":n|null, "risk_pct_used":n,
```
