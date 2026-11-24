# Dashboard REST and MCP

Run `npm run dashboard:api` separately from `npm start`. REST defaults to
127.0.0.1:8787. HTTP MCP defaults to 127.0.0.1:8788 at /mcp. Use
`Authorization: Bearer <DASHBOARD_API_TOKEN>` for both. The allowlisted
`DASHBOARD_ORIGIN` can send REST preflights. HTTP MCP accepts native clients
with an allowlisted Host and rejects requests carrying an Origin header.
Stdio uses the local process's filesystem permissions.

| REST under /api/v1 | MCP tool | Response |
| --- | --- | --- |
| GET /health | | API process and readable journal |
| GET /status | get_status | Last recorded worker state and cycle, breaker, pause, positions and published equity |
| GET /positions | list_positions | Open positions, entry price, size, age, nullable mark and unrealized P&L |
| GET /equity | get_equity | Latest publication and up to 50 recent publications |
| GET /audit | get_recent_audit | Newest-first events. Optional limit (1–200), ISO `since` and `cursor` from `next_cursor` |
| GET /candidates | get_candidates | Most recent Scanner batch and the last cycle's watched targets |
| GET /risk | get_risk | Current risk config and revision metadata |
| POST /controls/live-execution | set_live_execution | Arm or disarm new live orders with `{ "enabled": true }` or `{ "enabled": false }` |
| POST /controls/pause | pause_entries | Queue an entry pause |
| POST /controls/resume | resume_entries | Queue a resume subject to normal checks |
| POST /controls/risk | update_risk | Queue `{ "config": { … } }` against the existing risk schema |
| POST /controls/exit | request_exit | Queue `{ "run_id": "…" }` or `{ "chain": "…", "token": "…" }` |
| POST /controls/reject | reject_token | Queue `{ "chain": "…", "token": "…" }` for permanent entry rejection |

MCP also exposes the read-only `audit://journal` resource. The existing
unversioned live-view SSE and trade history routes remain available to the
standalone frontend.
Point the frontend at the VPS API origin. After submitting a risk revision,
refresh the current risk view once the worker applies the queued request.

Controls return a receipt with `request_id`, authenticated service actor,
normalized action and state. A queued REST request returns 202. Resubmit
the same request with its `request_id` to retrieve its latest receipt.
Conflicting reuse returns 409. Set `DASHBOARD_OPERATOR` to name the
shared credential's operator. Stdio uses the same configured name.

The services share a durable file inbox. Only the worker applies commands,
at the start of its next cycle. It records outcomes in the audit journal,
appends risk revisions and restores pause state and permanent rejections on
replay. Entries stay paused while the exit watcher continues. Exit requests
prioritize a specific position for evaluation with a fresh quote and its
existing exit policy. A request can remain pending until the policy permits
a close. A run ID shared by multiple open positions returns 409. A token
rejection prevents future entries for that chain and token.

Status reports the last recorded loop state. After an abrupt kill, use the
cycle timestamp to assess freshness and systemd to check actual liveness.
A queued command can wait through a slow cycle or breaker cooldown. Local
tests exercise fixture journals and mock trading providers. Remote HTTPS,
desktop client setup and a live droplet are deployment checks.

Live execution starts disarmed for a new live journal. Send
`POST /api/v1/controls/live-execution` with a boolean `enabled` to change it.
The worker applies it on its next control cycle. Check
`GET /api/v1/status` for `execution_mode` and `live_execution_enabled`.
A paper worker rejects arming. The last applied setting survives restarts
of the same live journal. Disarming blocks new entries, exits, and fee
replacements. Attempts already committed to the wallet journal can finish
submission and remain under reconciliation. Commands are queued, so this
switch takes effect when the worker applies it.

## Phase 3 control plane

All endpoints start with `/api/v1` and use the dashboard bearer token.
Controls return a request ID for the worker queue. Use the same
`request_id` and payload to check the action receipt. The worker applies
changes at cycle boundaries and retains submitted orders and open positions.

| GET / POST path | MCP tools | Behavior |
| --- | --- | --- |
| GET /providers and /providers/:id | get_providers, get_provider | Configuration, last observed health, and budget usage |
| POST /providers/:id/enable and /disable | enable_provider, disable_provider | Toggle a configured provider |
| GET /strategies and /strategies/:id | list_strategies, get_strategy | Definitions, parameters, enabled states and recent win rate |
| POST /strategies/:id/enable, /disable and /params | enable_strategy, disable_strategy, update_strategy_params | Submit a strategy change |
| POST /strategies/reload | reload_strategies | Reload trusted local strategy files |
| GET and POST /mode | get_mode, set_mode | Current and next modes with a change reason |
| GET and POST /chain, POST /controls/chain | get_chain_routing, set_chain_routing | Chain selection and allocation |
| GET and POST /budget | get_budget, set_budget | Budget and exhaustion behavior |
| GET /signals | get_recent_signals | Latest signals with their decision status |
| POST /controls/approve/:id and /controls/reject/:id | approve_signal, reject_signal | Record a human decision while the signal is fresh |

Example mode payload is `{"config":{"mode":"human"},"reason":"review new entries"}`.
Set parameters with `{"params":{"minLiq":60000}}` on
`/strategies/volume-spike/params`. An approval expires in 120 seconds.
An approved signal still passes the trading pipeline on reevaluation and is
consumed at most once. No API can directly call the signer.

### Execution safety controls

All three routes are authorized separately from status. The live signer reads a shared durable marker immediately before signing and again before sending.

| HTTP | Effect |
| --- | --- |
| POST /api/v1/controls/emergency-stop | Block entries and keep protective exits eligible. Receipt state is reduce_only when the signer has not been fully disarmed. |
| POST /api/v1/controls/flatten | Block entries and ask the position watcher to exit every eligible open position. Each exit still requires a fresh quote and normal execution checks. Requires step-up in OAuth mode. |
| POST /api/v1/controls/disarm-signer | Block signatures and broadcasts for entries and exits. Requires confirmation DISARM in the JSON body and step-up in OAuth mode. |

The worker keeps reconciling already-submitted transactions. A receipt records the effective gate and request ID. Flatten acknowledges the exit request before positions are confirmed closed. An active gate persists across restarts and regular pause, resume and live-entry controls cannot clear it. An authorized reset workflow is separate from these controls.

The safety markers live in the shared control inbox. REST receipts are logged in api-log.jsonl next to the audit journal by default, with API_LOG_PATH overrides for Docker and systemd pointing to the writable controls directory. Request bodies and signed data are excluded. The full API and MCP audit writer belongs to the API-log batch.

For the degraded-browser test, launch `node --import tsx scripts/safety-browser-fixture.ts` from the backend and run `node scripts/safety-controls.browser.mjs` from the frontend with its dev server active. Use the fixture only. It forces HTTP 500 for status and forwards safety calls to the real control service using an isolated temporary inbox.
