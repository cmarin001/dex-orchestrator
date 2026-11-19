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

Set these project environment variables to enable paper runs:

- `OPENAI_API_KEY` for Responses API access.
- `PAPER_RUN_SECRET` for the bearer token protecting the POST endpoint.
- `PAPER_RUN_TARGET` to a single JSON object with `chain`, `token`, and `pair`.

`OPENAI_MODEL` and `GOPLUS_ACCESS_TOKEN` are optional. Keep keys in Vercel
environment variables. No wallet keys are required. The deployment includes no
scheduled runs.
