# Agent contracts

The six specialized prompts in `prompts/` send their documented inputs
directly to the Responses API. Their outputs are parsed with strict Zod
schemas in `schemas/`.

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

The three Recon adapters continue to use the single-target prompts in
`prompts/runtime/`. The expanded Recon prompts require different tools and
inputs. The pipeline consumes observed pool volume and age from DexScreener
and security fields from the existing adapters. A missing critical Rug Check
field blocks entry. A provider summary marked clear supplies no substitute
for a missing field.

The paper quote models zero gas and expected price impact. The worker applies
its existing cash, position, and risk caps to the proposed USD amount before
passing the approved paper size to Executor. Paper executor outputs cannot
authorize offline signing. The existing transaction signer uses its
separate approval type.
