# 0004 Add a TradeKeel paper desk backed by the audit journal

The dashboard reads market discovery, fills, equity, and open-position
projections. It has no model credentials or signing boundary. Risk settings
are the sole write operation. Each validated change appends an attributed,
dated revision. Sizing loads the most recent revision and fails closed when
it is stale. An operator can inspect earlier rows or restore one by appending
it again.

Profit-only and stop-loss are mutually exclusive by type and by validation.
The profit-only variant carries no stop-loss field. The worker checks the
positive profit floor and the time ladder before recording a paper close.
At max hold the last eligible target stays in effect. Existing positions with
no assigned policy remain visible in equity and retain their legacy behavior.

The frontend adapts TradeKeel’s paper desk header, brass and sage color tokens,
and static favicon and social card. The source repo couples its desk
components to the old simulator, wallet handlers, and authentication, so the
React views were rebuilt around read-only data. The dashboard has no dependency
on the TradeKeel repository or Grok runtime. The orchestrator uses the
OpenAI Responses API specified in ADR 0001.

Hono provides a Web Request/Response interface usable on both the Node worker
host and a Vercel Function. The local worker owns a durable JSONL journal.
The Vercel dashboard reads an HTTPS worker API or a read-only JSONL export.
Persistent hosting and export credentials are provided by the operator.
The Vercel one-shot runner returns ephemeral audit events to its caller.

The live chart uses bounded SSE connections with browser fetch, which allows
a bearer header. The browser reconnects after a bounded stream completes.
This avoids persistent WebSocket connections and URL credentials. The
publisher projects the latest hour of marks from the audit journal and limits
each series to 720 points. The dashboard reports closes directly from journal
events. It maintains no separate trade-history store.

Discovery uses GeckoTerminal’s paginated DEX pool API. DexScreener’s public
API exposes search and token-pair lookups and lacks a paginated per-chain
listing. The discovery triggers evaluate pool age, changes in hourly volume, and
changes in pool liquidity. The scanner, mandatory Rug Check, and code sizing
remain the authority on candidates.
