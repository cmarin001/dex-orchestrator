# Phase 1C wallet provisioning

## Pre-funding checklist

- [ ] Keep a dedicated TradeKeel wallet recovery phrase offline. Confirm the
  destination addresses in the wallet and in the repository's public manifest.
- [ ] Install Phase 1C and the shared deploy lock. Run the wizard on the
  droplet's trusted interactive console during a worker maintenance window.
- [ ] Confirm all four address checks succeeded. Run the read-only verification.
- [ ] Recreate the worker from the updated Compose configuration so its bind
  mounts see the new files. Keep it in paper mode for verification.
- [ ] Run the deployment checks in `deploy/scripts/99-verify.sh`, review the
  chain tiers below, and confirm the active signer address before transferring
  funds. Verify one supported chain at a time. For Bitcoin, verify native
  SegWit signing and the native-transfer adapter before any funding.

## What the wizard does

Run the following commands yourself from the deployment console. Enter the
phrase in the hidden prompt. The operator also confirms the addresses and
handles any funding or rotation.

```sh
sudo /opt/dex-orchestrator/deploy/cicd/setup-secrets.sh
sudo /opt/dex-orchestrator/deploy/cicd/verify-secrets.sh
```

The wizard validates EVM, Solana, native SegWit and Taproot before publishing
any signer file. It writes three mode-600 files owned by `deploy:deploy`
in `/opt/dex-orchestrator/secrets/`. The validator writes keys directly
to staging files and returns only public verification results. The
matched Solana path is stored in the host's `secrets/addresses.json`
and the dashboard's public-only `data/wallet-addresses.json`. The repository
manifest records the candidate paths and leaves the matched path unset
until provisioning. The recovery phrase stays in process memory during
provisioning. The wizard creates no mnemonic file.

## If verification fails

**Wrong phrase or path.** Compare the public addresses and the Solana probe
results to Phantom. If the account uses another index, path grouping, or
BIP39 passphrase, stop and verify the account offline before adjusting the
public manifest. This wizard supports the three configured hardened paths and
the default empty BIP39 passphrase.

**Permissions or deploy lock.** Check that the directory is deploy-owned with
mode 700, keys are deploy-owned with mode 600, and the deployment lock has
been installed. Do not print file contents to check permissions.

**Dependencies.** Install Node 20.19+, npm, jq and whiptail on the host. The
installer fetches the repository's pinned npm dependency graph as deploy.
It runs before the prompt. Derivation then runs offline.

**Upgrade from Phase 1B.** The worker now mounts
`bitcoin_segwit_private_key.txt` as `BITCOIN_KEY_FILE` and reads 64 hex digits.
Run the initializer to create a placeholder if Bitcoin is unused. To
replace an existing mnemonic-backed signer, stop the worker and use the
wizard. It unlinks old mnemonic files only after address verification and
confirmation. Copies in old backups, images, or snapshots require separate
review and remediation.

## Rotation

Resolve pending transactions and protect or sweep funds with a trusted wallet
before replacing any signer. Update the public manifest for the replacement
dedicated wallet and stage the matching release. Run the wizard with
`--force` and type `OVERWRITE` after reviewing the current public addresses.
Verify before recreating the worker and returning to live operation. A
different recovery phrase normally changes all four addresses.

## Recovery

On a replacement droplet, restore the same public manifest and run the
wizard using the offline copy of the dedicated wallet phrase. The same
phrase and paths recover the same signer addresses. Review journal
continuity before resuming live operation.

## Chain support

| Networks | Tier | Signer and funding |
|---|---|---|
| Ethereum, Base, BNB Chain, Polygon | `fundable` | EVM signer. Deposit-address action requires a matched provisioning record. |
| Solana | `fundable` | SLIP-0010 Ed25519. Requires a matching path and provisioning record. |
| Bitcoin Native SegWit | `fundable` | Derived BIP84 key file. Native BTC transfers only. |
| **Bitcoin Taproot** | `validation_only` | **Funding blocked.** The wizard compares the public BIP86 address. No Taproot signer file is created. |
| **Arc, Robinhood Chain, HyperEVM** | `tracked` | **Funding blocked.** No trading adapter for these chains in this phase. |

The authenticated dashboard Wallets page has every public address. It
shows native balances if you configure server-side HTTPS endpoints in
`WALLET_BALANCE_ENDPOINTS`. A string value is a read-only RPC URL for
supported chains or an Esplora base URL for Bitcoin. For a tracked EVM
chain, use `{"url":"https://your-rpc.example","chain_id":"0x123"}`, with the
verified chain ID. Missing, mismatched or failed RPCs show unavailable.
Use endpoints without embedded credentials and keep provider keys
outside `.env`. The deposit action copies a public address. The worker's
existing chain and execution controls govern transaction signing.

## Secret handling

Keep the recovery phrase and signer keys out of browser forms, chat,
GitHub, command arguments, logs, environment variables, and image builds.
Use the hidden console prompt for the phrase. Any future browser-based
setup needs a separate reviewed design. A localhost-bound, short-lived
setup behind an SSH tunnel has more exposure than this console wizard.

## Follow the operation

On the droplet, use `sudo journalctl -t tradekeel-wallet -f -o cat` to follow
provisioning and verification. Filter by `operation_id` to follow one run.
The wizard's stderr carries more detailed offline derivation results under
the same ID. Each event includes a timestamp, component, stage, outcome,
reason code, and elapsed time. The verifier reports individual signer-file
failures, including permissions or ownership and address mismatches.

For the Wallets endpoint, read the dashboard API container logs and filter
for `wallet.overview`, `wallet.funding_gate`, or `wallet.balance`. The events
distinguish a missing provisioning record, a mismatch, missing RPC setup,
a wrong chain ID, and request failures. Use the response's `X-Request-Id`
to join the API logs to the BFF's `wallet.proxy` event. Clipboard actions
happen on the device and are visible in the browser console.

Logs omit recovery phrases, private keys, balances, wallet addresses,
cookies, raw request bodies, and raw provider URLs.
