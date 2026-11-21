# ADR 0005. Keep execution and decision modes independent

Phase 3 keeps paper trading and the live execution switch independent from the
agent selection mode. A fresh worker uses the Base chain, deterministic
strategies, and paper. The live signer, risk controls, and immutable prompt
contracts continue to protect the execution boundary.

The local actor supplies the same validated handoff types as the model actor.
Recon uses the same bounded market and security tools. Strategy signals go
through the existing Scanner, Rug Check, Sizer, and Executor path. Human
decisions expire after 120 seconds by default. Only the worker can advance a
signal to a trade, and a fresh candidate must still pass the chain and
portfolio limits after approval. The existing watcher retains its risk exit
rules even while new entries are paused.

One Chat Completions adapter implements the four configured providers.
Structured-output providers receive a JSON schema. JSON-only providers receive
the schema in a stable prefix, and all outputs pass through the existing Zod
and handoff checks. Cost routing follows the configured order. Failures can
trigger failover or a cycle-level fallback. Provider health reflects the
latest attempted request and retry cooldown. This avoids paid probes during
deterministic operation. Usage journals reserve conservative estimates before
a request and record returned token usage including cached input. Unknown
usage retains the reservation. The worker's budget relies on configured rate
and token bounds. Configure provider-side billing controls for account-wide
limits.

Cache only validated Scanner and Rug Check outputs. The key includes the
prompt, tool definitions, schema, and exact input. TTL is 60 seconds. Sizer,
Executor and the remaining stages always recompute.

REST and MCP share the worker command inbox. Commands become effective at
the next cycle. Mode, chain, provider, strategy, and budget changes append
attributed records in their respective journals. The worker audit receipt is
the applied-state authority. Hot switching changes new decisions and preserves
pending transactions and open positions. A live worker uses its one
configured signer chain. Deploy a separate live worker and journal to enable
a second live chain.

[Strategies and available evidence](../strategies.md) ·
[REST and MCP](../dashboard-api.md) · [Live wallet](../live-runbook.md)
