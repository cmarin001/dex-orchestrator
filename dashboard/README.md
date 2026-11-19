# TradeKeel paper desk

From the repository root, install both workspaces with `npm install` and
`npm --prefix dashboard install`. Set `DASHBOARD_API_TOKEN` in the root
`.env`. Run `npm start` for the paper worker and `npm run dashboard:api`
for the Hono API in separate terminals. Start the frontend with
`npm --prefix dashboard run dev` and open the Vite URL printed in the terminal.
Enter the dashboard token in the browser. The tab keeps the token in memory.

The worker and API use the same `AUDIT_PATH` and `RISK_CONFIG_PATH`.
Set `ENABLE_DISCOVERY=true` to scan the configured venues alongside a
watchlist. Save the risk form to append an initial revision. Set
`REQUIRE_RISK_CONFIG=true` to require a revision before any new entry.
The worker refuses new entries once a saved revision reaches
`MAX_RISK_CONFIG_AGE_SEC`.

The Vercel build serves the desk at `/dashboard` and the existing one-shot paper
endpoint at `/api/paper`. Set `DASHBOARD_API_TOKEN` in Production. Connect either
an HTTPS worker API with `DASHBOARD_WORKER_API_URL` or a read-only JSONL export
with `DASHBOARD_JOURNAL_URL` and its optional `DASHBOARD_JOURNAL_READ_TOKEN`.
The worker API must use the same dashboard token. The read-only export supports
charts and history, and editing risk requires the worker API. A one-shot paper
response stays scoped to that request and does not populate the worker journal.
Paper exits omit fees, slippage, and network settlement.
