# Phase 5 — CI/CD (main → droplet)

**Repos:** `cmarin001/dex-orchestrator` (backend) + `cmarin001/dex-orchestrator-app` (frontend)
**Target:** the DigitalOcean droplet configured in Phase 1B
**Scope:** GitHub Actions pipelines that build, test, publish, and deploy on merge to `main`
**Status:** Specification — do not modify the backend's `prompts/`

---

## How to use this prompt

1. **Read the safety model first.** A trading bot is not a web app. Auto-deploy
   without a pause/health-check/rollback sequence is a rejected PR.
2. **Two repos, two workflows, one shared droplet deploy script.** Do not
   try to make one repo call the other. Both push to GHCR; both SSH to the
   droplet; the droplet's `deploy.sh` serializes with a lock.
3. **Every image is tag-addressable by git SHA.** Rollback is
   `deploy.sh --image <previous-sha>`. No `latest` tag in production.
4. **If anything is ambiguous, stop and ask.** See §Open questions.
5. **Never add Python. Never deploy from a non-`main` branch. Never skip the
   health check.**

---

## Boundary

### You produce (both repos)

| Repo | Artifact | Purpose |
|---|---|---|
| `dex-orchestrator` | `.github/workflows/ci.yml` | Lint, typecheck, test on every push and PR |
| `dex-orchestrator` | `.github/workflows/deploy.yml` | Build image → push to GHCR → SSH deploy on merge to `main` |
| `dex-orchestrator` | `deploy/docker/Dockerfile` (extend Phase 1B) | Accept `BUILD_VERSION` build-arg |
| `dex-orchestrator-app` | `.github/workflows/ci.yml` | Lint, typecheck, test, build on every push and PR |
| `dex-orchestrator-app` | `.github/workflows/deploy.yml` | Build image → push to GHCR → SSH deploy on merge to `main` |
| `dex-orchestrator-app` | `Dockerfile` (new) | Multi-stage: Vite build → Nginx serve static |
| `dex-orchestrator-app` | `nginx.conf` (new) | SPA fallback + security headers for the static app |
| both | `.github/dependabot.yml` | Weekly PR for GitHub Actions versions |
| both | `docs/rollback.md` | One-page rollback runbook |

### On the droplet (the agent writes these into the backend repo under `deploy/`)

| File | Purpose |
|---|---|
| `deploy/cicd/deploy.sh` | The single deploy entrypoint. Receives `--repo`, `--image`, `--sha`. Locks, pauses, deploys, health-checks, resumes or rolls back. |
| `deploy/cicd/rollback.sh` | Thin wrapper: `deploy.sh --image <previous-sha>` |
| `deploy/cicd/healthcheck.sh` | 60-second poll against `/api/v1/health` and `/api/v1/status` |
| `deploy/cicd/install-deploy-key.sh` | One-time setup on the droplet: create a `deploy` SSH user, install the GitHub Actions public key, `chmod 700` the deploy dir |

### The human does

| Step | Why the agent can't |
|---|---|
| Add secrets to each GitHub repo (see §Secrets) | Requires GitHub UI access |
| Generate an SSH keypair for GitHub Actions → droplet | Requires running `ssh-keygen` on your machine or the droplet |
| Install the public key on the droplet (`deploy/cicd/install-deploy-key.sh`) | Requires SSH as the `deploy` user |
| Enable branch protection on `main` | Requires GitHub admin |
| Approve the first deploy manually | The first run should be watched |

The runbook (`docs/rollback.md` in both repos) must state this boundary.

---

## The safety model — read before writing the deploy script

A web app's deploy is "swap the container, done." A trading bot's deploy
has to sequence around the bot's own state machine.

### Deploy sequence (every deploy, both repos)

1. **Acquire the lock.** `flock -n /var/lock/dex-deploy.lock` — if another
   deploy is running, exit 0 with a clear message, do not queue. GitHub
   Actions will report "skipped: deploy in progress."
2. **Signal the worker.** Write `/opt/dex-orchestrator/data/.deploying` and
   touch the worker's control file. The worker reads this at the top of its
   next cycle and **finishes the current cycle without opening new
   positions**. Exits continue to run. If the worker does not acknowledge
   within 90 seconds, exit 1 — do not kill the container mid-trade.
3. **Snapshot the journal.** `cp data/audit.jsonl data/audit.jsonl.pre-<sha>`.
   The journal is the recovery source; back it up before touching the
   container.
4. **Record the previous image.** Read the running image tag from
   `docker inspect --format '{{.Config.Image}}' dex-worker` and write it to
   `data/.last-known-good`.
5. **Pull the new image.** `docker pull ghcr.io/<owner>/<repo>:<sha>`.
   If pull fails, exit 1 — do not proceed.
6. **Swap the container.** `docker compose up -d --no-deps worker dashboard mcp`
   with the new image tag. Use `--no-deps` so nothing else restarts.
7. **Health check.** `deploy/cicd/healthcheck.sh` polls for 60 seconds:
   - `/api/v1/health` returns 200
   - `/api/v1/status` returns 200 and `last_cycle_at` advances within 60s
   - The worker container is `running`, not `restarting`
   If any check fails: **automatic rollback** (step 8).
8. **Rollback.** Re-deploy `$(cat data/.last-known-good)`. Re-run the health
   check. If the rollback also fails, page the human and stop — do not loop.
9. **Clear the deploying flag.** Remove `/opt/dex-orchestrator/data/.deploying`.
   The worker resumes opening positions on its next cycle.
10. **Release the lock.**
11. **Record.** Append `{ sha, deployed_at, previous_sha, health: "pass" }`
    to `data/deploy-log.jsonl`.

### The rule that makes this safe

The worker never opens a new position while `.deploying` exists. If a
deploy fails midway, `.deploying` stays, the worker stays in "no new
entries" mode, and the bot is effectively paused — which is the correct
default when something went wrong. The operator clears it by re-running
`deploy.sh` or by removing the file manually after investigation.

### Frontend deploys don't pause the bot

The `-app` repo's `deploy.sh` runs the same script with `--repo app`. It
acquires the same lock (so it can't collide with a backend deploy) but
**skips steps 2 and 9** — the bot has no state that a static-asset deploy
can corrupt. The frontend's health check is `curl -f http://127.0.0.1:3000/`
returning the expected `<title>`.

---

## Deliverable: file tree

### `dex-orchestrator` (backend)

```
.github/
├── workflows/
│   ├── ci.yml
│   └── deploy.yml
└── dependabot.yml

deploy/
├── cicd/
│   ├── deploy.sh
│   ├── rollback.sh
│   ├── healthcheck.sh
│   └── install-deploy-key.sh
└── docker/
    ├── Dockerfile            # extended — accept BUILD_VERSION
    └── docker-compose.yml    # extended — image: ${IMAGE_TAG}

docs/
└── rollback.md
```

### `dex-orchestrator-app` (frontend)

```
.github/
├── workflows/
│   ├── ci.yml
│   └── deploy.yml
└── dependabot.yml

Dockerfile                    # new — Vite build → nginx:alpine
nginx.conf                    # new — SPA fallback + security headers

docs/
└── rollback.md
```

---

## File specs

### `deploy/docker/Dockerfile` (backend — extend Phase 1B)

Add at the top, before the first `FROM`:

```dockerfile
ARG BUILD_VERSION=dev
```

Add labels to the runtime stage:

```dockerfile
LABEL org.opencontainers.image.version="${BUILD_VERSION}" \
      org.opencontainers.image.source="https://github.com/cmarin001/dex-orchestrator" \
      org.opencontainers.image.revision="${BUILD_VERSION}"
```

The pipeline passes `--build-arg BUILD_VERSION=${GITHUB_SHA}`. The app reads
`process.env.BUILD_VERSION` (already wired in Phase 2's `src/index.ts`;
if not, add it) and exposes it on `/api/v1/health` as `version`.

### `deploy/docker/docker-compose.yml` (backend — extend Phase 1B)

Every service that comes from CI uses a variable image:

```yaml
services:
  worker:
    image: ${IMAGE_TAG:-ghcr.io/cmarin001/dex-orchestrator:dev}
    # … rest unchanged from Phase 1B
  dashboard:
    image: ${IMAGE_TAG:-ghcr.io/cmarin001/dex-orchestrator:dev}
  mcp:
    image: ${IMAGE_TAG:-ghcr.io/cmarin001/dex-orchestrator:dev}
```

The deploy script exports `IMAGE_TAG=ghcr.io/<owner>/<repo>:<sha>` before
running `docker compose up`. Local dev keeps working with the `:dev` default.

### `dex-orchestrator-app/Dockerfile` (new)

```dockerfile
# Build stage
FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Serve stage
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null || exit 1
```

### `dex-orchestrator-app/nginx.conf` (new)

```nginx
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Cache immutable assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Never cache index.html
    location = /index.html {
        add_header Cache-Control "no-cache";
    }
}
```

### `.github/workflows/ci.yml` (both repos)

Runs on every push and every PR. **Does not deploy.**

```yaml
name: ci
on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint --if-present
      - run: npm run typecheck --if-present
      - run: npm test
      - run: npm run build
```

No secrets are referenced. CI must pass on a fork PR without access to
secrets — that is the point.

### `.github/workflows/deploy.yml` (backend)

```yaml
name: deploy
on:
  push:
    branches: [main]

concurrency:
  group: deploy-dex-orchestrator
  cancel-in-progress: false     # never cancel a deploy mid-flight

permissions:
  contents: read
  packages: write

jobs:
  test:
    # same steps as ci.yml test job — required, cannot be skipped
    uses: ./.github/workflows/ci.yml

  build-and-push:
    needs: test
    runs-on: ubuntu-24.04
    outputs:
      image: ${{ steps.meta.outputs.image }}
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - id: meta
        run: echo "image=ghcr.io/${{ github.repository }}:${{ github.sha }}" >> $GITHUB_OUTPUT
      - uses: docker/build-push-action@v6
        with:
          context: .
          file: deploy/docker/Dockerfile
          push: true
          tags: |
            ${{ steps.meta.outputs.image }}
            ghcr.io/${{ github.repository }}:latest
          build-args: |
            BUILD_VERSION=${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

  deploy:
    needs: build-and-push
    runs-on: ubuntu-24.04
    environment:
      name: production
      url: https://dex.yourdomain.com
    steps:
      - uses: actions/checkout@v4
      - name: Install SSH key
        run: |
          mkdir -p ~/.ssh
          echo "${{ secrets.DROPLET_SSH_KEY }}" > ~/.ssh/id_ed25519
          chmod 600 ~/.ssh/id_ed25519
          echo "${{ secrets.DROPLET_HOST_KEY }}" > ~/.ssh/known_hosts
      - name: Deploy
        env:
          IMAGE: ${{ needs.build-and-push.outputs.image }}
          SHA: ${{ github.sha }}
        run: |
          ssh -i ~/.ssh/id_ed25519 deploy@${{ secrets.DROPLET_HOST }} \
            "IMAGE_TAG='$IMAGE' /opt/dex-orchestrator/deploy/cicd/deploy.sh \
              --repo backend --image '$IMAGE' --sha '$SHA'"
      - name: Notify on failure
        if: failure()
        run: |
          # optional: curl a webhook, or write to $GITHUB_STEP_SUMMARY
          echo "## Deploy failed" >> $GITHUB_STEP_SUMMARY
          echo "Run \`deploy/cicd/rollback.sh\` on the droplet." >> $GITHUB_STEP_SUMMARY
```

**The `environment: production` line is the manual-approval gate.** In the
GitHub repo settings, create an environment named `production` and add
yourself as a required reviewer. The first deploy will pause and wait for
your approval. Remove the reviewer requirement only after you trust the
pipeline.

### `.github/workflows/deploy.yml` (frontend)

Identical structure. Differences:

- `image: ghcr.io/${{ github.repository }}:${{ github.sha }}` (same pattern, different repo)
- `deploy.sh --repo app` instead of `--repo backend`
- The frontend's `deploy.sh` skips the pause/resume steps (see §Safety model)
- Optional: `paths-ignore: ['docs/**', '**.md']` to skip doc-only merges

### `deploy/cicd/deploy.sh` (backend — the core)

```bash
#!/usr/bin/env bash
set -euo pipefail

# Parses --repo, --image, --sha
# Acquires flock on /var/lock/dex-deploy.lock
# If --repo backend:
#   1. touch data/.deploying
#   2. wait for worker ack (poll status, 90s timeout)
#   3. cp data/audit.jsonl data/audit.jsonl.pre-$SHA
#   4. record previous image in data/.last-known-good
#   5. docker pull $IMAGE
#   6. IMAGE_TAG=$IMAGE docker compose -f deploy/docker/docker-compose.yml up -d --no-deps
#   7. deploy/cicd/healthcheck.sh
#   8. if healthcheck fails: rollback and exit 1
#   9. rm data/.deploying
# If --repo app:
#   docker pull $IMAGE
#   docker compose -f /opt/dex-orchestrator/deploy/docker/docker-compose.yml \
#     -f /opt/dex-orchestrator/deploy/docker/docker-compose.app.yml up -d --no-deps app
#   curl -f http://127.0.0.1:3000/ | grep -q '<title>'
# Always: append to data/deploy-log.jsonl, release lock
```

The full script is ~120 lines. The agent writes it. Requirements:

- `set -euo pipefail`
- Every external command's exit code is checked
- Every log line is timestamped and written to `data/deploy.log`
- The script is idempotent — running it twice with the same `--sha` is a no-op
- The script refuses to run as root (`[[ $EUID -ne 0 ]] || exit 1`)
- The script verifies the image exists (`docker manifest inspect $IMAGE`) before pulling
- On any failure, `data/.deploying` stays in place — the worker stays paused

### `deploy/cicd/healthcheck.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
TOKEN=$(cat /opt/dex-orchestrator/secrets/dashboard_api_token.txt)
DEADLINE=$((SECONDS + 60))
LAST_CYCLE=""
while (( SECONDS < DEADLINE )); do
  health=$(curl -sf -o /dev/null -w '%{http_code}' \
    -H "Authorization: Bearer $TOKEN" \
    http://127.0.0.1:8787/api/v1/health || echo "000")
  [[ "$health" == "200" ]] || { sleep 2; continue; }
  status=$(curl -sf -H "Authorization: Bearer $TOKEN" \
    http://127.0.0.1:8787/api/v1/status || echo '{}')
  cycle=$(echo "$status" | jq -r '.last_cycle_at // empty')
  if [[ -n "$cycle" && "$cycle" != "$LAST_CYCLE" ]]; then
    LAST_CYCLE="$cycle"
    sleep 5   # confirm it advanced twice
    continue
  fi
  sleep 2
done
exit 1
```

Health check must confirm the worker is **cycling**, not just that the API
is up. An API that responds 200 while the worker is dead is exactly the
failure mode this check exists to catch.

### `deploy/cicd/install-deploy-key.sh`

One-time setup. Must:

- Run as `deploy` user (refuse as root)
- Create `/home/deploy/.ssh` with `700`, `authorized_keys` with `600`
- Append the public key passed as stdin
- Print the `DROPLET_HOST_KEY` value (from `ssh-keyscan`) so the human can
  paste it into GitHub secrets
- Refuse if the key already exists (idempotent, but explicit)

### `docs/rollback.md` (both repos)

One page. Must contain:

- The exact command to roll back: `ssh deploy@<host> /opt/dex-orchestrator/deploy/cicd/rollback.sh`
- What `rollback.sh` does (re-deploys `data/.last-known-good`)
- How to check the current and previous versions: `cat data/.last-known-good` and `curl /api/v1/health | jq .version`
- How to clear a stuck `.deploying` flag after investigation
- The "if the droplet is unreachable" path: GitHub Actions is the source of truth; find the previous green `deploy` run, copy its `sha`, run `deploy.sh --image ghcr.io/...:$SHA --sha $SHA`
- The boundary: rollback is a manual, one-command operation, not automated

---

## Secrets to add to each GitHub repo

### Both repos

| Secret | Value | How to generate |
|---|---|---|
| `DROPLET_SSH_KEY` | Private Ed25519 key for `deploy@droplet` | `ssh-keygen -t ed25519 -C "github-actions@dex" -f ./deploy_key -N ""` |
| `DROPLET_HOST` | `dex.yourdomain.com` or droplet IP | — |
| `DROPLET_HOST_KEY` | Output of `ssh-keyscan dex.yourdomain.com` | Run `install-deploy-key.sh` and copy the printed value |

`GITHUB_TOKEN` is automatic — no secret to add. It has `packages: write`
via the `permissions:` block.

### Why not reuse the operator's SSH key

The GitHub Actions key must be **separate** from your personal key. If the
key leaks via a compromised workflow, you revoke one key, not your identity.
The `deploy` user on the droplet should have a dedicated key, and that key
should be the only thing in `/home/deploy/.ssh/authorized_keys` for the
GitHub Actions path — your personal key goes in a second entry.

---

## GHCR cleanup

Without a rule, GHCR accumulates every SHA forever. Add to the backend repo
`.github/workflows/ci.yml` or a separate `ghcr-cleanup.yml`:

```yaml
- uses: actions/delete-package-versions@v5
  with:
    package-name: dex-orchestrator
    package-type: container
    min-versions-to-keep: 20
    delete-only-untagged-versions: false
```

Keep the last 20 (about 20 deploys of rollback depth). Same for `-app`.
`latest` is tagged on every deploy but never deployed from — it exists for
convenience.

---

## Verification — run before you merge the first deploy

The pipeline is done when **all** of these are true:

- [ ] A PR to `main` runs `ci.yml` and fails on a deliberately broken test
- [ ] A merge to `main` runs `ci.yml`, then `build-and-push`, then `deploy`
- [ ] The `deploy` job waits for the `production` environment approval
- [ ] After approval, the droplet's `deploy.log` shows the full sequence
- [ ] `/api/v1/health` reports the new `version` (the git SHA)
- [ ] `data/deploy-log.jsonl` has a new row with `health: "pass"`
- [ ] `data/.last-known-good` contains the **previous** SHA after a successful deploy
- [ ] A deliberately broken deploy (rename a required env var) triggers rollback within 60s
- [ ] After rollback, `/api/v1/health` reports the **previous** SHA
- [ ] `data/.deploying` is cleared after rollback (operator must clear it manually — verify the runbook documents this)
- [ ] Two simultaneous merges (backend + frontend) serialize via the lock; the second reports "skipped: deploy in progress"
- [ ] `rollback.sh` restores the previous version in < 30 seconds
- [ ] The frontend deploys without pausing the bot (`data/.deploying` never appears)
- [ ] GHCR has exactly the expected number of tagged versions after 5 deploys

---

## What NOT to do

- ❌ Do not deploy from a branch other than `main`
- ❌ Do not skip `ci.yml` — the `deploy` job must `needs: test`
- ❌ Do not deploy `:latest` — always deploy a `:sha` tag
- ❌ Do not skip the health check "just this once"
- ❌ Do not loop on rollback failure — one rollback, then page the human
- ❌ Do not kill the worker container mid-cycle — wait for the ack
- ❌ Do not use the operator's personal SSH key in GitHub secrets
- ❌ Do not store the `DASHBOARD_API_TOKEN` in GitHub secrets for the deploy job — the droplet already has it as a Docker secret; the health check reads it locally
- ❌ Do not auto-approve the `production` environment on day one
- ❌ Do not add Watchtower, Argo, Flux, or any auto-sync tool — they deploy on image push, not on a tested merge
- ❌ Do not add Python, a second CI system, or a self-hosted runner
- ❌ Do not deploy the frontend and backend from one workflow — two repos, two workflows
- ❌ Do not skip `--no-deps` on `docker compose up` — it restarts unrelated services
- ❌ Do not `git pull` on the droplet as part of deploy — the image is the artifact; the repo checkout is only for `deploy.sh` and compose files

---

## Open questions — stop and ask

1. **Droplet SSH user:** Phase 1B created `deploy`. Confirm the GitHub
   Actions key goes into `/home/deploy/.ssh/authorized_keys`, not root.
2. **Domain for `production` environment URL:** `https://dex.yourdomain.com`
   or different?
3. **Frontend hostname:** `https://app.yourdomain.com` (separate Nginx
   server block) or `https://dex.yourdomain.com/` with backend under
   `/api/`? The Phase 1B Nginx config assumes the latter — confirm.
4. **Doc-only merges:** skip the deploy, or run it (faster but wasteful)?
   The prompt defaults to running it. `paths-ignore` is a one-line change.
5. **Notification on failure:** GitHub's default email, or a webhook
   (Slack/Discord/ntfy)? The prompt includes only the step-summary fallback.
6. **Retention depth:** 20 GHCR versions is the default. Increase if you
   want a longer rollback window.

---

## First commit (per repo)

```
ci: build, test, publish to GHCR, deploy to droplet on main
```

PR title:

```
Phase 5: CI/CD — tested merge, GHCR image, droplet deploy with health check and rollback
```

PR description must state: (a) the pause/health-check/rollback sequence,
(b) that `production` environment requires manual approval, (c) that
`:sha` tags are the only deployable artifacts, and (d) the rollback
command from `docs/rollback.md`.

## Approved corrections after review

- Production uses `https://dex-orchestrator.best` for Nginx, ACME, the
  GitHub environment, dashboard origin, and the Auth0 callback. Both
  apps share the origin.
- The acknowledgment window is `max(3 × loop_interval_sec, 90)`. The health
  window is `max(2 × loop_interval_sec + 30, 120)`. Obtain the interval
  from the loopback probe and require two post-swap cycle timestamps
  separated by at least that interval.
- The direct loopback `GET /api/v1/health` probe requires no credential.
  It exposes the version, the cycle timestamp, the interval, and journal
  health. Browser and remote status remain authenticated.
- Retain 50 GHCR versions and exclude versions tagged
  `production`, `rollback`, or `latest`. Deploy by full Git SHA. Move
  aliases after verification, protecting the previous image before swapping.
- Skip doc-only deploys and use GitHub failure notifications. Use the
  existing deploy account with dedicated CI keys, one host lock, and
  separate rollback records. Automatic rollback is attempted once.
  On backend deployment failure, entries stay paused until operator review
  and explicit resume.
