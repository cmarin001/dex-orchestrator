# trade-bot

TypeScript ESM scaffold for a nine-prompt DEX pipeline. The standard entry point runs **paper trades** using public provider reads. The Executor includes offline EVM and Solana signing for transactions supplied by trusted code. Live routing, broadcast, receipt reconciliation, exits, and a social data feed are integration boundaries.

## Run

```bash
nvm use
npm install
npm run build
npm test
cp .env.example .env
```

Set `OPENAI_API_KEY` and a nonempty `WATCHLIST` in `.env`. Each watchlist element supplies `chain`, the base `token` address, and the liquidity-pool `pair` address. Supported chain identifiers are `ethereum`, `bsc`, `base`, and `solana`. Run `npm start` to start the control loop. Use Ctrl+C to stop. Use one process per audit journal. The startup path replays simulated fills from the journal, restoring committed position costs. Market marks refresh after restart.

Amounts and position limits use integer USD cents and basis points. Paper fills use an observed USD price and omit fees, slippage, routing, and settlement. The fixtures contain recorded public provider responses. Tests use those recordings, synthetic candidates, and mocked OpenAI calls. Live OpenAI access requires a model that supports Responses function calling and Structured Outputs.

[Architecture](docs/architecture.md) · [Schemas](docs/schemas.md) · [Runtime ADR](docs/adr/0001-runtime.md)

## Vercel

The Vercel entry point serves a status response at `GET /` and runs one
isolated paper-trading candidate at `POST /api/paper`. Every invocation starts
with a fresh simulated portfolio and returns its audit events in JSON. The
continuous worker and persistent journal are available through `npm start`.
Send a precomputed snapshot as `{ "recon_snapshot": { ... } }` in the
authenticated POST. An empty request returns a `stale_recon` skip. The
Vercel function has no shared state with the worker. See the
[Recon snapshot contract](docs/schemas.md#recon-snapshots).

Set these project environment variables to enable paper runs:

- `OPENAI_API_KEY` for Responses API access.
- `PAPER_RUN_SECRET` for the bearer token protecting the POST endpoint.
- `PAPER_RUN_TARGET` to a single JSON object with `chain`, `token`, and `pair`.

`OPENAI_MODEL` is optional. Keep keys in Vercel environment variables.
The background worker optionally accepts `GOPLUS_ACCESS_TOKEN`. The deployment includes no
scheduled runs.

## TradeKeel paper dashboard

See the [standalone dashboard](https://github.com/cmarin001/dex-orchestrator-app),
[dashboard API setup](docs/dashboard-api.md), and
[ADR 0004](docs/adr/0004-dashboard-and-tradeKeel-reuse.md) for risk settings,
discovery, automated paper exits, live charts, and audit-derived trade history.

## Backend logging

The worker, Hono server, and Vercel routes emit one JSON record per operational
event. Set `LOG_LEVEL=debug` for provider requests, tool calls, cache hits, audit
I/O, individual stages, and SSE lifecycle. The default `info` level includes
startup and shutdown, agent timings, candidate outcomes, paper fills and exits,
signing, risk edits, and HTTP request status. Failures are emitted at `warn`
or `error`. Use `LOG_LEVEL=silent` to suppress operational logs.

Filter by `request_id` for HTTP activity and by `run_id` for a candidate or
position. Timings are in milliseconds and cover the instrumented operation.
For SSE, the HTTP timing ends when the response is created. A separate stream
record measures its lifetime.

Operational records omit credentials, URLs and query values, prompts,
model output, provider payloads, transaction bytes, and raw exception
messages. The append-only audit journal remains the source for decision
details and dashboard projections. Its format and persistence are unchanged.
