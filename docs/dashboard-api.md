# Dashboard API v1

The [standalone frontend](https://github.com/cmarin001/dex-orchestrator-app)
uses the JSON and SSE API below. Provider credentials, signing, and journal
writes stay on the worker. A validated risk revision is the API's only write.

## Run the backend

Set `DASHBOARD_API_TOKEN` in the backend environment. Start `npm start` for
the worker and `npm run dashboard:api` for Hono. Both processes need the
same `AUDIT_PATH`, `RISK_CONFIG_PATH`, and `INITIAL_EQUITY_CENTS`. The worker
continues independently of frontend availability.

For direct browser connections, set `DASHBOARD_ORIGIN` to the frontend's
exact origin, including scheme and hostname. Requests require
`Authorization: Bearer <DASHBOARD_API_TOKEN>`. The approved browser origin
may use OPTIONS for CORS preflight without posting credentials.

The existing Vercel Function at `/api/dashboard-data` accepts an
`endpoint` query parameter containing the path listed below. It can proxy
an HTTPS worker at `DASHBOARD_WORKER_API_URL` or read a JSONL export at
`DASHBOARD_JOURNAL_URL` using `DASHBOARD_JOURNAL_READ_TOKEN` when required.
Risk writes require the worker API. The one-shot `/api/paper` endpoint
keeps an independent, per-request state.

| Method | Path | Response |
| --- | --- | --- |
| GET | `/health` | Status and mode |
| GET | `/equity` | Current equity, realized P&L, committed cents, and position count |
| GET | `/journal` | Audit events with optional date and run filters |
| GET | `/live-view` | Open-position snapshots, optionally filtered by token |
| GET | `/live-view/stream` | SSE `live-view` events with snapshot arrays |
| GET | `/trades` | Closed trades, filters, and cursor pagination |
| GET | `/risk-config` | Risk configuration, revision, and editability |
| POST | `/risk-config` | Appends and returns a validated risk revision |

The live-view, risk configuration, and history models are in
[`schemas/`](../schemas). Keep the frontend's v1 wire types compatible
when evolving those payloads.
