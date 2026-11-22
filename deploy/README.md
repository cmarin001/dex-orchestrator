# Deploy on a DigitalOcean droplet

Docker Compose is the recommended production path in Phase 1B. The existing
Phase 1 systemd units remain available for bare metal. Pick one installation
method for each set of ports and journals.

The repository provides artifacts, copy-paste commands, and the local go-live
gate. The operator creates the droplet and DNS record, applies the cloud
firewall, signs in via SSH, runs the scripts, enters the credentials, obtains
the certificate with Certbot, and funds the hot wallet. **Step 2 is the only
step that explicitly requires the DigitalOcean control panel.** The host
scripts run on the operator's machine or droplet.

## Prerequisites

Use a dedicated Ubuntu 24.04 droplet with at least 2 GB of RAM, an authorized
SSH public key, and a DNS hostname. Point its A record at the droplet.
If you publish an AAAA record, apply the same cloud firewall to IPv6 and
test both IPv6 service ports from off-host. Keep the droplet console available
during SSH hardening. Keep separate watchlists, journals, and signing keys for
separate wallets or chains.

**Before funding any wallet**, use a dedicated hot wallet on each chain and
keep each below 5% of total capital. Choose a sweep threshold below that limit.
Move balances above the threshold to a verified cold address in a separate
manual operation. Keep only the working balance and required network fees in
the hot wallet.

## Step 1. Provision the user and SSH policy

From the initial root session:

```bash
apt-get update && apt-get install -y git
test -d /root/dex-orchestrator-bootstrap/.git ||
  git clone https://github.com/cmarin001/dex-orchestrator.git /root/dex-orchestrator-bootstrap
bash /root/dex-orchestrator-bootstrap/deploy/scripts/00-bootstrap.sh
```

From a second terminal, verify key login as `deploy` and confirm `sudo -v`
works before you harden SSH. Keep the original session open. Then, as deploy:

```bash
test -d /opt/dex-orchestrator/.git ||
  git clone https://github.com/cmarin001/dex-orchestrator.git /opt/dex-orchestrator
cd /opt/dex-orchestrator
sudo bash deploy/scripts/00-bootstrap.sh --harden-ssh
```

Open another SSH session as deploy and repeat the login test. The host
firewall permits TCP 22, 80, and 443. Fail2ban monitors SSH via journald,
and unattended upgrades install security patches only.

## Step 2. Apply the DigitalOcean Cloud Firewall

In the DO panel, select **Networking → Firewalls → Create Firewall**.
Give it a name, attach it to this specific droplet, and review every
firewall already attached to that droplet. In the screenshot you should
see the following three rows under Inbound Rules and the intended
droplet under Apply to Droplets. Remove broader attached allow rules
that conflict with this policy before relying on it.

| Protocol | Port | Source |
| --- | ---: | --- |
| TCP | 22 | Administration IPv4 /32 and/or IPv6 /128 |
| TCP | 80 | All IPv4 and IPv6 addresses |
| TCP | 443 | All IPv4 and IPv6 addresses |

Keep outbound access for DNS, package updates, and configured providers.
Docker can bypass UFW for published ports. The cloud firewall filters
before packets reach the host, UFW adds host defense, and Compose binds
8787 and 3001 to `127.0.0.1` with no worker ports. Nginx is the public
application listener. [DigitalOcean firewall rules](https://docs.digitalocean.com/products/networking/firewalls/how-to/configure-rules/) ·
[Docker and UFW](https://docs.docker.com/engine/install/ubuntu/#firewall-limitations)

## Step 3. Install Docker

```bash
cd /opt/dex-orchestrator
sudo bash deploy/scripts/01-docker-install.sh
sudo docker compose version
```

The installer configures the official signed Docker apt repository.
Use `sudo docker` and keep deploy outside the Docker group.

## Step 4. Prepare settings and secrets

```bash
cd /opt/dex-orchestrator
test -e .env || install -m 0600 .env.example .env
chmod 0600 .env
nano .env
bash deploy/scripts/02-secrets-init.sh
```

Set `OPERATING_MODE=strategies`, `EXECUTION_MODE=paper`, and enable
discovery or configure a nonempty Base watchlist. Keep the journal under
`data/`. The first paper run uses `data/audit.jsonl` and needs only the
generated dashboard token. Compose mounts credential files under
`/run/secrets/`. The initializer creates optional files with a sentinel
and lists missing required files. A configured live chain requires its
signing material and RPC file. An enabled remote model in AI or hybrid
mode requires its provider credential. Complete only the needed files in
`/opt/dex-orchestrator/secrets/` using an editor, then rerun the initializer.
Use separate signer keys per chain. See the [secrets runbook](../docs/secrets-runbook.md)
for native SegWit key provisioning and wallet verification.

Keep the secret directory at mode 700 and its files at 600, owned by deploy.
The scripts pass deploy's numeric UID and GID into Compose because local
Compose uses file bind mounts for secrets. The worker mounts wallet and
provider files. Dashboard and MCP each mount only the shared bearer token.
Do not put credential assignments or sensitive URLs in `.env`. The deploy
script validates the file before starting containers. Use the legacy
environment names only for existing bare-metal installations.
[Compose secret mounts](https://docs.docker.com/compose/how-tos/use-secrets/)

## Step 5. Configure Nginx and TLS

```bash
cd /opt/dex-orchestrator
sudo bash deploy/scripts/03-nginx-setup.sh
```

Enter the DNS hostname and ACME contact email when prompted. The script
sets up the initial HTTP virtual host, uses the Nginx ACME challenge, and
enables renewal. HTTPS hosts a minimal status page at `/` and forwards
`/api/` to the authenticated dashboard at loopback port 8787. MCP remains
private. Use an SSH tunnel to productively reach MCP on port 3001.

## Step 6. Deploy or update

```bash
cd /opt/dex-orchestrator
bash deploy/scripts/04-deploy.sh
```

The script uses a fast-forward pull, validates secrets and configuration,
builds the image, and starts Compose. It prints the worker log tail only
after a credential check. Its runtime builds compiled ESM against Node 20
as specified. Node 20 is past its supported lifetime, so the specified
image still needs a runtime-baseline upgrade before a long-term production
rollout. Deploy uses the host `data/` directory for journals and the control
inbox. Preserve it during image updates.

For a local developer stack, use a separate checkout and local data and secret
directories. Create test secret files first. The dev override forces paper
and strategies and uses loopback port bindings. Include both Compose files and
set `DEX_DEV_DATA_DIR` and `DEX_SECRETS_DIR` to their local absolute paths.

## Step 7. Verify from the outside and the host

From the external administration machine with the droplet SSH host key in
`known_hosts`, run the first half. Use the actual IPv4 address from the DO
panel. Check any advertised IPv6 address separately for blocked 8787 and
3001. Keep the outside result local until the paper soak in Step 8 finishes.

```bash
read -rp 'DNS hostname: ' DEX_DOMAIN
read -rp 'Droplet public IPv4: ' DEX_IP
bash deploy/scripts/99-verify.sh --external "$DEX_DOMAIN" "$DEX_IP" > dex-external-proof
test -s dex-external-proof && scp dex-external-proof "deploy@$DEX_IP:~/dex-external-proof"
```

Run these host checks as deploy after the soak. Repeat the outside check
if the recorded result is more than one hour old.

```bash
cd /opt/dex-orchestrator
read -rp 'DNS hostname: ' DEX_DOMAIN
read -rp 'Droplet public IPv4: ' DEX_IP
sudo bash deploy/scripts/99-verify.sh "$DEX_DOMAIN" "$DEX_IP" "$HOME/dex-external-proof"
```

The gate reports PASS or FAIL and returns an error on any failed check.
It authenticates through Nginx only after confirming unauthenticated
requests receive 401. The bearer value travels through standard input.
After other checks pass, the verifier briefly stops the paper worker,
captures the open positions from disk, restarts, and compares the
worker's replayed position keys. Run the verifier against paper.
It writes a verification receipt for the exact commit. Treat the outside
proof as operator evidence and retain the cloud firewall screenshot.

To test a failed configuration without exposing a value, temporarily
change the **file mode** of a required credential, run the verifier and
confirm it exits 1, then restore mode 600 and run the verifier again.

## Step 8. Run paper first

Leave the worker in strategies and paper for 48 hours. Check that the
audit journal has both skips and at least five paper fills in that period.
The unattended worker should perform no model requests. Use a discovery
scope or Base watchlist that can produce candidates without relaxing the
existing risk checks. Run the final Step 7 check after the soak.

## Step 9. Go live

Read the [live runbook](../docs/live-runbook.md) and validate the provider,
allowance, receipt, and exit path. A successful verifier receipt is
required by the live deploy script and expires after 24 hours. Use low
spend and fee caps, mount the needed credentials, set a separate
`AUDIT_PATH` for live, and deploy while disarmed. Enable live execution
only when the configured wallet, starting balance, and destination
addresses are verified. Repeat the documented checks on a changed codebase.

## Ongoing maintenance

| Cadence | Action |
| --- | --- |
| Daily | Save a cohesive data snapshot under `/backups/`. Back up wallet recovery material separately offline. |
| Weekly | Review worker health, unauthenticated API rejection, fee caps, and journal growth. |
| Monthly | Check certificate renewal, restore a recent snapshot in isolated paper mode, and review the cloud firewall. |
| Quarterly | Rotate credentials where appropriate and verify the manual cold-wallet sweep path. |

## Recovery

Before a local snapshot, schedule a maintenance window. For live, disarm
and reconcile pending transactions before stopping writers. As deploy in
the checkout run:

```bash
cd /opt/dex-orchestrator
sudo install -d -m 0700 /backups
sudo docker compose --env-file .env -f deploy/docker/docker-compose.yml stop
sudo tar -C /opt/dex-orchestrator -czf "/backups/dex-data-$(date +%F).tar.gz" data
sudo docker compose --env-file .env -f deploy/docker/docker-compose.yml start
```

For a recovery drill, extract a reviewed archive into a fresh, isolated
directory using `sudo tar -xzf ARCHIVE -C RECOVERY_DIRECTORY`, inspect it,
and use that data in paper mode with a dedicated deployment. A production
restore requires offline reconciliation of wallet balances, pending IDs,
and any transactions newer than the backup. Preserve the previous data
directory and restore its ownership and journal permissions. Keep live
disarmed through reconciliation.

## Bare-metal alternative

The Phase 1 units under `deploy/systemd/` remain supported. Install a
supported Node LTS under `/usr/local/bin`, provision the non-root `dex`
service account, and place the checkout at `/opt/dex-orchestrator`.
Set nonsecret configuration in the mode-600 `.env` and configure each
service's allowed secret file paths in its environment. Use
`DASHBOARD_API_TOKEN_FILE` for dashboard and MCP, and for example
`EVM_KEY_FILE` and `ZEROX_API_KEY_FILE` for the worker.

```bash
sudo -u dex npm ci
sudo install -m 0644 deploy/systemd/*.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now dex-worker dex-dashboard
sudo systemctl enable --now dex-mcp
```

The systemd defaults are loopback ports 8787 and 8788. Install the same
Nginx proxy for the dashboard API if needed. Configure a worker-only
credential file and principal for any live setup. The Compose verification
script targets the Compose path.
