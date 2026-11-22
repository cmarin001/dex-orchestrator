# Droplet deployment and rollback

## One-command rollback

```sh
ssh deploy@dex-orchestrator.best /opt/dex-orchestrator/deploy/cicd/rollback.sh
ssh deploy@dex-orchestrator.best /opt/dex-orchestrator/deploy/cicd/rollback.sh --repo app
```

Use your operator SSH key. The CI keys accept only their own repository's
`deploy <full SHA>` command. The scripts use `/var/lock/dex-deploy.lock` across
both repos. A busy run reports **skipped**. Re-run that Actions deployment
if its release is still wanted.

From the droplet, inspect the local deployment probe and records.

```sh
curl -fsS http://127.0.0.1:8787/api/v1/health | jq '{version,last_cycle_at,journal_readable,loop_interval_sec}'
cat /opt/dex-orchestrator/data/.last-known-good
cat /opt/dex-orchestrator/data/.last-known-good.app
tail /opt/dex-orchestrator/data/deploy-log.jsonl
```

Each record is an independent rollback SHA. Backend updates take a parseable
snapshot of the configured journal, then wait for a clean stop. Exits and
reconciliation continue through the pause and the worker drains work at
shutdown. The deployment never copies a snapshot over the journal.
The backend uses `max(3 × loop_interval_sec, 90)` for acknowledgment and
`max(2 × loop_interval_sec + 30, 120)` for the cycle check once the new probe
responds. Two post-swap cycle timestamps must be at least one loop apart.

A failed swap triggers one automatic rollback. A failed run leaves backend
entries paused even if the rollback is healthy. After checking pending
transactions, journal state, and the deployed version, use:

```sh
ssh deploy@dex-orchestrator.best /opt/dex-orchestrator/deploy/cicd/deploy.sh --resume
```

It verifies two new cycles under the same lock before clearing the marker.
Frontend rollback leaves the worker alone. If you lose SSH, recover access
through the droplet console. Find the prior successful **deployed** Actions
run, cross-check its SHA against the host deployment log, then run
`deploy/cicd/rollback.sh --repo backend --image <full-sha>` (or `--repo app`).
The worker health check can exceed 30 seconds by design.

## First deployment checklist

1. Set up the DNS for `dex-orchestrator.best` and run
   `sudo bash deploy/scripts/03-nginx-setup.sh` for its certificate and server
   block. Then enable the app's matching same-origin location snippet. Set
   `DASHBOARD_ORIGIN=https://dex-orchestrator.best`. For Auth0, set
   `BFF_PUBLIC_ORIGIN=https://dex-orchestrator.best` and register callback
   `https://dex-orchestrator.best/auth/callback`. Keep the API host-only.
2. Keep both Actions repositories' `PRODUCTION_DEPLOY_ENABLED` unset during
   setup. Enable branch protection and create a **production** environment
   restricted to `main` with required reviewers. Confirm the repositories'
   GitHub plan supports approval gates. Add the SSH host, private key, and
   pinned server host key as environment secrets. Use one dedicated keypair
   per repo. From the droplet, run
   `deploy/cicd/install-deploy-key.sh backend < backend.pub` and
   `deploy/cicd/install-deploy-key.sh app < app.pub` as `deploy`.
3. Install the shared lock declaration with
   `sudo install -m644 deploy/cicd/dex-deploy.tmpfiles.conf /etc/tmpfiles.d/dex-deploy.conf`
   and `sudo systemd-tmpfiles --create /etc/tmpfiles.d/dex-deploy.conf`.
   Install the versioned scripts and Compose files at `/opt/dex-orchestrator`
   and the app Compose checkout at `/opt/dex-orchestrator-app`. The deployment
   command never pulls Git on the host. Updates to host scripts are an
   explicit operator step.
4. Docker runs through the existing deploy user's sudo boundary. CI
   requires `sudo -n /usr/bin/docker` for that operator account and a
   root Docker GHCR login that can pull and move package tags. Rootful
   Docker access is root-equivalent. Keep the SSH keys restricted to the
   installed forced command. Use an approved GitHub-hosted runner whose
   egress can reach the restricted SSH port. Set `PRODUCTION_DEPLOY_RUNNER`
   if needed. Keep Docker registry and trading credentials on the droplet.
5. Seed the first versioned backend and frontend images in **paper**
   mode under supervision. The old worker predates the pause handshake,
   so the deploy script deliberately fails closed if that first upgrade is
   attempted unattended. Verify the token-free API probe, the worker
   version, the same-origin UI and (if enabled) the BFF. Set
   `data/.cicd-enabled` on the droplet only after bootstrap, then set
   `PRODUCTION_DEPLOY_ENABLED=true` in both repositories and approve the
   first Actions run. Keep production reviewers until the cutover is proven.

Images deploy only by a full SHA. GHCR keeps the newest 50 versions and
excludes versions tagged `production`, `rollback` or `latest` from deletion.
The workflow never publishes or pulls `latest`. Before a swap, the registry
rollback tag pins the previous image. After verification, the production
tag moves to the running image. If a package alias is missing, cleanup
fails closed. Allow the repo's Actions token to administer its GHCR package.
