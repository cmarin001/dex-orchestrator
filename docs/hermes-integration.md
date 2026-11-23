# Hermes operator assistant

Phase B starts with read-only stdio. Hermes reads the worker journal and cites the audit run ID or endpoint behind each answer. The server must exclude mutation tools from its Hermes profile. The worker and signer retain execution authority. A client-side tool filter alone does not enforce read-only access.

## Transport and authentication

Hermes supports a URL for Streamable HTTP and a command for stdio under `mcp_servers`. See the [official Hermes MCP guide](https://hermes-agent.nousresearch.com/docs/user-guide/features/mcp). The backend's existing MCP process defaults to loopback. Its HTTP transport checks host and bearer headers. In OAuth-only mode the current HTTP handler has no accepted token and rejects requests. Remote HTTP follows later with an API-key bearer and a server-side read-only policy, then OAuth when the MCP handler supports it. Do not copy the dashboard credential to Hermes.

Proposed local configuration for the OAuth-only backend profile, after verifying it exposes only read tools. Set the working directory or supply explicit read-only journal paths for the child process.

```yaml
mcp_servers:
  tradekeel:
    command: node
    args: ["/opt/dex-orchestrator/dist/src/mcp/server.js"]
    env:
      DASHBOARD_AUTH_MODE: auth0
      AUDIT_PATH: "/opt/dex-orchestrator/data/audit.jsonl"
      RISK_CONFIG_PATH: "/opt/dex-orchestrator/data/risk-config.jsonl"
```

Confirm the entrypoint against the built image and use a dedicated process identity with read access to the needed journal files only. The remote example in the specification uses `dex-orchestrator.best`. The operator previously identified `dex-orchestratr.best` as the owned hostname. The remote origin requires verification before documenting it as a production URL. SSE retains authorization headers or a same-origin BFF session.

## Tool and resource projection

Preserve existing read tool names for existing clients. In the dedicated Hermes profile, use canonical names below and reuse the REST read services. Streams remain browser transport. Authenticated exports or diagnostics require the same actor scope and redaction as REST. No command or quote submission tools are in the initial allowlist.

| Read surface | Proposed Hermes tools |
| --- | --- |
| Status and diagnostics | get_health, get_status, get_system_health, get_diagnostics |
| Positions and candidates | list_positions, get_position, list_candidates |
| Equity and performance | get_equity, get_performance, get_funnel |
| Trade history | list_trades, get_trade, export_trades |
| Audit | get_audit, export_audit |
| Risk and command observation | get_risk_config, get_trading_limits, get_receipt, get_mode |
| Strategy, chain, provider | list_strategies, get_strategy, list_chains, list_providers |

Expose `audit://journal`, `status://current`, and `equity://current` as read-only resources. Receipt visibility is actor-scoped. Tool filters and pagination mirror the REST reads in the endpoint register. Any future mutation profile needs explicit approval, server-side authorization and equivalent step-up checks.

## Operator prompts

- Why did TradeKeel skip this Base token yesterday? Cite the scan and risk audit run IDs.
- When did the worker last cycle, and how many candidates passed Rug Check? Cite the status and funnel reads.
- Which Solana positions are open, and which marks are unavailable? Cite the position read and applicable run IDs.
- Which strategy had the highest measured win rate this week? Show the trade count and cite the performance source.
