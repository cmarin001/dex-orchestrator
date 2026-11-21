# Agent handoffs

Each file under `prompts/` has a corresponding Zod schema in `schemas/`.
Scanner, Recon A, and Recon C return arrays. Their Responses transport uses
an internal object containing `rows` and unwraps that object before returning.

Recon B keeps every raw check key. The seven logical flags accept numeric 0,
numeric 1, or null. The data layer converts flags to booleans and preserves
null. Tax basis points, concentration percentage, and holder count retain
their numeric values or null. Rug Check receives a complete Scanner row plus
these checks. Social data stays out of both ranking and safety decisions.

Sizer consumes Equity Curve's published balance, drawdown and timestamp.
A missing observation yields null equity and age. A missing reference price
yields null token size. The worker applies cash and exposure caps in cents
before invoking Executor. Logger preserves the hop object and reports missing
fields. Equity Curve publishes performance from closed trades.

The authenticated Vercel paper request accepts `{ "recon_snapshot": ... }`.
See `schemas/recon-snapshot.ts` for the normalized source records. Its
timestamps use milliseconds, while agent timestamps use Unix seconds.
The optional `expected_slippage_bps` field drives the paper execution guard.

[Conformance tests and residual gaps](conformance.md)
