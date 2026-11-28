# trade-bot

TypeScript ESM scaffold for a nine-prompt DEX pipeline. The standard entry point runs **paper trades** using public provider reads. The Executor includes offline EVM and Solana signing for transactions supplied by trusted code. Live routing, broadcast, receipt reconciliation, exits, and a social data feed are integration boundaries.

## Run

```bash
nvm use
npm ci
npm run build
npm test
npm run simulate
cp .env.example .env
```

Set a nonempty `WATCHLIST` or enable discovery in `.env`. The default strategy mode makes zero model calls and needs no provider key. Base is enabled first. Each watchlist element supplies `chain`, the base `token` address, and the liquidity-pool `pair` address. Supported chain identifiers are `ethereum`, `bsc`, `base`, `solana`, `polygon`, `arbitrum`, and `optimism`. Run `npm start` to start the control loop. Use Ctrl+C to stop. Use one process per audit journal. The startup path replays simulated fills from the journal, restoring committed position costs. Market marks refresh after restart.

Amounts and position limits use integer USD cents and basis points. Paper fills use an observed USD price and omit fees, slippage, routing, and settlement. The fixtures contain recorded public provider responses. Tests use those recordings, synthetic candidates, and mocked OpenAI calls. Optional AI and hybrid modes use the configured Chat Completions providers with schema validation.

[Prompt conformance and verification](docs/conformance.md) · [Architecture](docs/architecture.md) · [Modular platform and integration guide](docs/modular-platform.md) · [Schemas](docs/schemas.md) · [Runtime ADR](docs/adr/0001-runtime.md)

## VPS deployment and MCP

Run the worker, dashboard REST API, and optional remote MCP server as separate
systemd services on Ubuntu 24.04. The worker runs discovery, Recon, and paper
execution. The other processes read the journal and queue operator requests.
See the [droplet setup and service units](deploy/README.md).

For local access, run the dashboard with `npm run dashboard:api` or launch
MCP over stdio from the checkout with:

```bash
node --env-file=.env --import tsx src/mcp/server.ts
```

Add this to Claude Desktop's MCP configuration or Cursor's `.cursor/mcp.json`.
Replace both absolute paths with paths on the machine running the client.

```json
{
  "mcpServers": {
    "dex-orchestrator": {
      "command": "/usr/local/bin/node",
      "args": [
        "--env-file=/opt/dex-orchestrator/.env",
        "--import", "/opt/dex-orchestrator/node_modules/tsx/dist/loader.mjs",
        "/opt/dex-orchestrator/src/mcp/server.ts"
      ],
      "env": {
        "AUDIT_PATH": "/opt/dex-orchestrator/data/audit.jsonl",
        "RISK_CONFIG_PATH": "/opt/dex-orchestrator/data/risk-config.jsonl",
        "CONTROL_INBOX_PATH": "/opt/dex-orchestrator/data/controls"
      }
    }
  }
}
```

The local client needs filesystem access to the same journal and inbox as the
worker. Remote clients use Streamable HTTP at `https://your-host/mcp` with
the dashboard bearer token. [REST and MCP reference](docs/dashboard-api.md)

## TradeKeel paper dashboard

See the [standalone dashboard](https://github.com/cmarin001/dex-orchestrator-app),
[dashboard API setup](docs/dashboard-api.md), and
[ADR 0004](docs/adr/0004-dashboard-and-tradeKeel-reuse.md) for risk settings,
discovery, automated paper exits, live charts, and audit-derived trade history.

## Backend logging

The worker, Hono server, and MCP server emit one JSON record per operational
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
details and dashboard projections.

## Live execution

Paper is the default. The Phase 2 signer runs inside the worker and uses
a dedicated journal and wallet. See the [live execution runbook](docs/live-runbook.md)
for chain order, configuration, constraints, and first-run checks.

## Decision modes

`OPERATING_MODE=strategies` is the default. Enable optional model providers
using `MODEL_PROVIDERS` and provider-specific keys. Local Ollama is configured
as `llama3.1:8b`. Configure provider order, fallback categories and health
cooldown with `MODEL_PROVIDER_POLICY`, and model tiers in
`config/models.json`. Confirm pricing and model availability for your
configured provider account before enabling paid modes.

[Control-plane ADR](docs/adr/0005-control-plane.md) ·
[Strategy reference](docs/strategies.md) · [REST and MCP](docs/dashboard-api.md)

## Phase 5 authentication

See [dashboard authentication](docs/dashboard-auth.md) for Auth0 settings,
scopes, MFA requirements and the shared-token migration modes.
