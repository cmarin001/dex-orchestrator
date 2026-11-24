# TradeKeel Hermes harness configuration

Use a local, read-only Hermes profile for the first integration. The backend Model MCP process loads the authenticated actor's saved profile, publishes only supported allowed reads, and checks the profile again at tool call time. The stdio process uses the service account's filesystem permissions. Its environment must point to the test journal or a deployment-approved read-only journal mount.

The current Hermes configuration key is `trust: untrusted` under a server entry. Hermes applies prompts based on the server's read-only annotation. The backend still enforces the hard floor and denies model writes at this stage. See the [Hermes MCP configuration reference](https://hermes-agent.nousresearch.com/docs/reference/mcp-config-reference).

```yaml
mcp_servers:
  tradekeel:
    command: node
    args: ["/opt/dex-orchestrator/dist/src/mcp/server.js"]
    env:
      MCP_PROFILE: harness
      DASHBOARD_AUTH_MODE: auth0
      DASHBOARD_OPERATOR: "${DEX_HARNESS_ACTOR}"
      AUDIT_PATH: "${DEX_HARNESS_AUDIT_PATH}"
      RISK_CONFIG_PATH: "${DEX_HARNESS_RISK_PATH}"
      CONTROL_INBOX_PATH: "${DEX_HARNESS_INBOX_PATH}"
    trust: untrusted
    tools:
      include:
        - get_status
        - list_positions
        - get_equity
        - list_candidates
        - get_risk_config
        - get_audit
        - list_strategies
        - list_providers
        - get_mode
        - get_chain
      exclude:
        - introspect_exec_signer_ts
        - introspect_wallet_key_source_ts
        - get_wallet_key_source
        - read_key_source
      prompts: false
      resources: false
```

`include` is an exact list of registered names and takes precedence over `exclude`. The denied names are absent from this include list and the server's model registry. For a reconnect, use the same `DEX_HARNESS_ACTOR` that owns the profile saved through the authenticated configuration API.

## Permission endpoints
`get_wallet_key_source` is the planned operator metadata view for file mode, owner and validation status. It never returns key bytes. `read_key_source` is a reserved raw-key name with no registered tool or API handler.

`GET /harness/capabilities` returns policy metadata. The three catalog DENY decisions and the 13 reflected hard-floor paths have `grantable: false`, as does the reserved raw-key name `read_key_source`. Metadata does not carry a callable tool schema or dispatch registration. Planned capabilities may appear in policy metadata before their backend implementation ships.

`PUT /permissions` replaces the authenticated actor's profile with a JSON object containing a `grants` map, for example `{"grants":{"get_status":"deny","queue_controls_pause":"ask"}}`. In Auth0 mode it requires the existing admin scope and recent MFA. Any hard-floor or DENY name set to allow or ask causes the whole update to return HTTP 403 and `{"error":"HARD_FLOOR"}`. Mutations are ineligible for allow. A profile change takes effect for dispatch immediately. Reconnect to refresh discovery.

An opted-in write needs a separate approval for its exact normalized arguments and independent backend step-up. This implementation records and replays those decisions in fixture evaluation. Live model MCP still publishes only approved reads. The remaining capability mirror and authenticated mutation dispatcher must ship before an ASK tool can run.

## Three-hop gate and fallback C

Current Hermes documents the stdio command `hermes mcp-serve`. Its optional `--tools` exposes a fixed curated set. See the [mcp-serve plugin page](https://hermes-agent.nousresearch.com/marketplace/mcp-serve). The upstream model connects to an isolated Hermes profile. Use fallback C when native discovery fails. Through Hermes then refers to the curated operator experience, while direct backend connections provide the raw TradeKeel MCP catalog.

After staging the isolated Hermes profile and real correlated API logging, run this acceptance check against the actual Hermes process:

```sh
HERMES_TEST_PROFILE=tradekeel-fixture \
  HERMES_TEST_API_LOG=/absolute/path/to/api-log.jsonl \
  node --import tsx scripts/check-hermes-three-hop.ts
```

It requires a real upstream `get_status` result and three new observed rows sharing one request ID. The check fails when the Hermes binary, forwarding tool or required trace is missing. A backend MCP handler using a shared service directly does not produce a REST hop. Only an actual REST request can satisfy the REST row. Fallback C does not make the raw three-hop test green.
