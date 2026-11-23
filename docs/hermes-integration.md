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

Preserve existing read tool names for existing clients. In the dedicated Hermes profile, use canonical names below and reuse the REST read services. Existing streams use browser transport; the introspection plan below adds MCP subscriptions. Authenticated exports or diagnostics require the same actor scope and redaction as REST. No command or quote submission tools are in the initial allowlist.

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

## Introspection operator layer

The [introspection inventory](./introspection-api.md) is the approval gate. The three modes below are separate integrations with separate credentials and tests.

### 1. Hermes as an MCP client

Use the existing stdio deployment for the first read-only test. Configure the allowlist with exact server-native names. Hermes registers tools from the include list when both lists are present, so the backend must independently enforce read-only access. Generate the full allowlist from the approved read manifest during implementation. See the [Hermes MCP configuration reference](https://hermes-agent.nousresearch.com/docs/reference/mcp-config-reference).

```yaml
mcp_servers:
  tradekeel:
    command: node
    args: ["/opt/dex-orchestrator/dist/src/mcp/server.js"]
    env:
      DASHBOARD_AUTH_MODE: auth0
      AUDIT_PATH: "/opt/dex-orchestrator/data/audit.jsonl"
      RISK_CONFIG_PATH: "/opt/dex-orchestrator/data/risk-config.jsonl"
    tools:
      include: [get_status, list_positions, get_equity]
      prompts: false
```

Remote transport comes later with a dedicated API-key bearer, followed by OAuth when supported. Verify that a real Hermes client discovers and calls a permitted read, that command tools are absent, and that a direct call cannot bypass the backend policy.

Live-view and audit tools return scoped resource handles. Verify subscription capability negotiation, scoped updates, cursor resume, and cleanup using the selected MCP client and protocol version. Hermes support for consuming these subscriptions needs an integration test. See the [MCP TypeScript SDK resource documentation](https://ts.sdk.modelcontextprotocol.io/v2/servers/resources).

### 2. Hermes as an MCP server

The documented Hermes MCP server is the [mcp-serve plugin](https://hermes-agent.nousresearch.com/marketplace/mcp-serve). It documents stdio and selected Hermes tools. The proposed Streamable HTTP CLI and automatic re-export of downstream TradeKeel tools are unverified. Pin a Hermes/plugin version and test whether a real upstream client can list and invoke an allow-listed TradeKeel read through that server. If downstream forwarding is absent, this mode requires a reviewed Hermes-hosted forwarding integration.

Keep the first test on stdio with an isolated Hermes profile. Forward a stable authenticated caller identity or a clearly identified service actor, along with a correlation ID. Leave writes absent by default. Any later opt-in command has to preserve equivalent backend scope and recent MFA. Log the upstream caller and backend hop with the same request ID.

### 3. Hermes as a model provider

The [Hermes API server](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server) advertises a model ID and serves an OpenAI-compatible chat endpoint. Add the opt-in router entry during the provider configuration phase, using the deployed model ID and the existing provider schema. Verify the endpoint, authentication, supported capabilities and budget behavior before enabling it. Keep the default routing order and test that the provider is considered only after explicit enablement and routing changes.

The provider path is advisory. The execution worker and signer remain responsible for order submission.
