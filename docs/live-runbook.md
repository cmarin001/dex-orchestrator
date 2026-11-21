# Phase 2 live execution runbook

The worker defaults to paper trading. Leave it there until the live release
checks below pass. Only the in-process wallet signs and broadcasts. The
Executor prompt and response schema retain the original transaction hash
field. The worker journals that model response, derives a separate intent from
the approved size and price bounds, and keeps it out of model context.
The signer uses a durable USD reservation and writes the locally derived
transaction ID before calling the chain. REST and MCP have no signer access.

## Configuration

Start with Base. Enable one chain at a time, validate Solana second, and
leave Ethereum mainnet until last. Set the variables from `.env.example` in
the **worker-only** environment. Use a unique `AUDIT_PATH` and
`CONTROL_INBOX_PATH` for each live deployment. Keep a single worker and
dedicated wallet per journal. Configure `INITIAL_EQUITY_CENTS` to match the
settlement capital you allocate to that worker. Use a limited watchlist and
configure vetted SPL or ERC-20 token decimals in `LIVE_TOKEN_DECIMALS`.
Set the settlement mint or contract, decimals and conservative USD upper bound
using the `LIVE_SETTLEMENT_*` settings. Accounting treats the settlement asset
as USD at par. Pause if the peg moves or if actual balances diverge from the
ledger. Native network fees appear in receipts and are separate from reported
settlement-token P&L and the USD spend limit.

Set `DAILY_LIMIT_USD`, `PER_TRADE_LIMIT_USD` and `LIVE_MAX_FEE_NATIVE`
before setting `EXECUTION_MODE=live`. The fee cap uses wei for EVM,
Once the live worker is running, send an authenticated POST to
`/api/v1/controls/live-execution` with `{"enabled":true}` and wait for
`live_execution_enabled` in status before expecting orders. Send
`{"enabled":false}` to disarm. This also blocks new exits and replacements.
The last applied value survives restart. BTC one-shot mode drains queued
controls on invocation. An unarmed invocation only reconciles existing IDs.
lamports for Solana and satoshis for Bitcoin. USD limits apply to entries and
exits. An unresolved submission blocks subsequent transactions. A rejected
simulation releases its unused reservation. Use a separate quote API key and
private RPC URL for the active chain. For Solana use a staked RPC where available.

| Chain | Quote and submission | Confirmation |
| --- | --- | --- |
| Base, Ethereum, BSC, Arbitrum, Polygon, Optimism | GET `https://api.0x.org/swap/allowance-holder/quote` with 0x v2 headers. Submit via the configured EVM RPC. With `MEV_PROTECTION=true` on Ethereum, submit exclusively to `https://rpc.flashbots.net`. | EVM receipt plus canonical block hash. Defaults to two confirmations on Ethereum and one elsewhere. |
| Solana | GET `https://api.jup.ag/swap/v1/quote` and POST `https://api.jup.ag/swap/v1/swap`. Rebuild compute budget from simulation and recent priority fees, verify settlement-account deltas independently, and submit via the configured Solana RPC. | Confirmed transaction and wallet token balance deltas. |
| Bitcoin native | Configured Bitcoin Core wallet RPC. Uses `listunspent`, `estimatesmartfee`, `testmempoolaccept`, and `sendrawtransaction`. Import the wallet's P2WPKH watch-only descriptor and enable the node's transaction index. | `getrawtransaction` with two confirmations by default. |

For EVM, provision narrowly scoped allowances on the verified 0x
AllowanceHolder before using the worker. Configure allowances for the sell
asset, including tokens that will be sold on exit. The worker rejects
missing balance/allowance and unapproved swap targets. L2 relay policy
differs from Ethereum mainnet. OP Stack publication fees use a buffered
estimate and can change before inclusion. ParaSwap is outside this change.
Bitcoin accepts native transfers only, via the worker entry point in one-shot
mode. Set `BITCOIN_TRANSFER` to a JSON object with the operator-selected
`run_id` (UUID), recipient, satoshis (decimal string), trusted `btc_usd`
upper bound, and `deadline_sec` (Unix seconds). Keep the same request and
journal for reconciliation. Use `BITCOIN_TESTNET=true` only with the
corresponding testnet wallet and RPC. Never run the one-shot transfer alongside
a worker sharing that wallet.

Provider references.
[0x quote and AllowanceHolder](https://docs.0x.org/docs/core-concepts/contracts) ·
[Jupiter Metis Swap](https://developers.jup.ag/docs/api-reference/swap/v1/swap) ·
[Flashbots Protect](https://docs.flashbots.net/flashbots-protect/quick-start) ·
[Bitcoin Core transaction lookup](https://bitcoincore.org/en/doc/26.0.0/rpc/rawtransactions/getrawtransaction/)

## Credentials and isolation

For `WALLET_MODE=env`, pass an EVM 0x-prefixed private key, a Solana 64-byte
JSON secret-key array, or a native Bitcoin P2WPKH private key as 64 hex digits.
Store the file with mode 600. Never reuse a personal wallet or a seed from a
cold wallet.

For systemd, keep key variables out of the shared `.env` and load a separate
root-owned mode-600 file using a worker-only drop-in. Phase 1 runs all services
under the same UID. For live use give the worker its own OS account and
adjust journal permissions so dashboard and MCP can read exported audit data
and write the control inbox without being able to read the worker process
environment. The code runs the signer in the worker. Separate signer services
can use a Unix socket in a later release.

```ini
[Service]
EnvironmentFile=/etc/dex-orchestrator/wallet.env
```

In a container deployment, mount secrets only in the worker container and
point its Node `--env-file` argument at the mounted file. Mount the writable
journal volume in the worker. Give dashboard and MCP read-only access to the
audit and risk journals and writable access only to the control inbox. The
sweep job is operator-run and separate from all three services.

For `WALLET_MODE=kms`, configure AWS credentials through the worker's
runtime identity, `AWS_REGION`, and `AWS_KMS_KEY_ID`. Use an AWS KMS
`ECC_SECG_P256K1` key with `SIGN_VERIFY` usage. Grant only the following
actions on the key ARN in IAM and authorize the worker principal in the
key policy. `GetPublicKey` derives the Ethereum address. The key remains
inside KMS. Solana and Bitcoin require env mode.
[AWS KMS Sign API](https://docs.aws.amazon.com/kms/latest/APIReference/API_Sign.html)

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["kms:GetPublicKey", "kms:Sign"],
    "Resource": "arn:aws:kms:REGION:ACCOUNT:key/KEY_ID"
  }]
}
```

## Reconciliation and release checks

A timeout at submission leaves the locally signed ID pending. On restart the
worker reconciles that ID from the journal before considering any new order.
A crash can leave the live journal's `.worker.lock` in place. Verify that the
original worker has stopped before clearing the lock. Preserve the journal.
A confirmed receipt with unexpected amounts requires manual reconciliation.

While the original intent is fresh, the wallet can make one bounded fee
replacement after observing the original pending transaction. EVM keeps the
nonce, destination, calldata and original gas limit. Bitcoin preserves every
input and the recipient output, raises the fee from wallet change, and checks
mempool acceptance. The wallet journals each identifier and checks all of them
on recovery. If the chain cannot identify the pending original, the wallet
holds the reservation for manual reconciliation.
The Solana signer can rebuild the same intent after finalized blockheight and
signature-history checks establish expiry. Worker recovery itself reconciles
only. It requires a new pipeline decision before any new order. Deep reorgs
after a confirmed position has already been applied require operator review.

Validate actual provider responses, KMS signatures, allowance setup, network
fee bounds, and a full entry and exit on the selected chain before funding the
worker. The PR uses mocked chains. Nominal LP, profit triggers and model
decisions do not guarantee an executable or profitable exit.

- [ ] Start with one chain and an isolated wallet holding under 5% of total capital.
- [ ] Set low spend and fee caps. Review the exit caps as well as entry caps.
- [ ] Fund only a small test amount after validating the release checks.
- [ ] On Ethereum mainnet, enable Flashbots Protect.
- [ ] Watch the first five transactions and verify each receipt against the journal.
- [ ] Sweep excess funds to a verified cold address in a separate manual job.
- [ ] Pause entries and reconcile outstanding transactions if a balance or receipt differs.

## First deploy on DigitalOcean

Follow [the Phase 1B deployment guide](../deploy/README.md). Keep each
chain's hot wallet below 5% of total capital and plan the separate manual
sweep before funding it. The operator runs the provisioning, configures
the cloud firewall and DNS, enters keys by hand, and obtains the certificate.

Before arming live execution, run `deploy/scripts/99-verify.sh` from
outside and on the host. The gate requires a 48-hour strategies-only
paper soak, skips and at least five paper fills, matching replayed positions
after restart, 401 without bearer credentials, blocked public ports 8787
and 3001, valid TLS and HSTS, and no credential values in the container
environment or retained worker logs. Compose verifies readable file mounts
and mode-600 host files. The gate also validates a successful authorized
request through Nginx.
