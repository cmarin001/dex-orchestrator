# Agent contracts

The six specialized prompts in `prompts/` have Responses API wrappers.
The worker evaluates Rug Check in TypeScript using the same output schema.
The wrappers parse outputs with strict Zod schemas in `schemas/`.

| Agent | Response contract |
| --- | --- |
| Scanner | Array of candidate rows with market fields, rank, reason, and skipped flag |
| Rug Check | `PASS` or `FAIL`, named check results, and reason |
| Sizer | `SIZED`, `REFUSED`, or `HALTED`, with size, equity, slippage, and reason |
| Executor | Action and terminal status, with nullable fill fields |
| Logger | Count and rows containing the original typed hop output and gaps |
| Equity Curve | Equity, drawdown, win rate, expectancy, count, and timestamp |

The request to OpenAI wraps the Scanner array in a `rows` object. Its
TypeScript wrapper returns the parsed array and checks that each row matches
its supplied feed item. Logger checks row identity and verifies that the
agent preserved each supplied output. Equity Curve validates the timestamp
and trade count. The worker continues to own the equity ledger and durable
audit journal.

The paper quote models zero gas and expected price impact. The worker applies
its existing cash, position, and risk caps to the proposed USD amount before
passing the approved paper size to Executor. Paper executor outputs cannot
authorize offline signing. The existing transaction signer uses its
separate approval type.

## Recon snapshots

`schemas/recon-snapshot.ts` defines the normalized handoff accepted by the
worker and the authenticated paper preview. Handoff timestamps are Unix
milliseconds.

| Field | Contract |
| --- | --- |
| `target` | Chain, token, and pair. Cache key is chain and token. The pair must match the requested pool. |
| `market` | Recon A only. Trigger, source fetch time, and sourced USD price, liquidity, 1h volume, and pool age. Numeric observations use `{ value, source, fetched_at }`. |
| `security` | Recon B only. Source fetch time, assessment, `checks_raw`, `sources_disagree`, and provenance keyed by source or check. Each numeric check requires a source and fetch time on its provenance entry. |
| `social` | Optional sourced score between 0 and 1. Missing and expired scores become null. |
| `market_failed_at` | Fetch failure timestamp when Recon A supplies no market evidence. |

Scanner receives token, pair, chain, trigger, liquidity, volume, age,
optional social score, and `as_of` in Unix seconds. Rug Check receives
identity, age for its safety threshold, raw checks, provenance, and the
conflict flag. Sizer reads liquidity from Scanner output. Cache misses
and expired observations skip before calling Scanner. A number without
provenance is a candidate error. Missing critical security evidence
blocks entry even when the provider's summary is clear.
