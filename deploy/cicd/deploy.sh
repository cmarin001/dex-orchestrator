#!/usr/bin/env bash
set -Eeuo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/healthcheck.sh"
export PATH=/usr/bin:/bin
umask 077

root=/opt/dex-orchestrator
app_root=/opt/dex-orchestrator-app
data=$root/data
lock=/var/lock/dex-deploy.lock
marker=$data/.deploying
ack=$marker.ack
repo=backend image='' sha='' operation=deploy
while (( $# )); do
  case "$1" in
    --repo) repo=${2:?}; shift 2 ;;
    --image) image=${2:?}; shift 2 ;;
    --sha) sha=${2:?}; shift 2 ;;
    --rollback|--resume)
      [[ $operation == deploy ]] || exit 2
      operation=${1#--}; shift ;;
    *) printf 'Invalid deploy argument\n' >&2; exit 2 ;;
  esac
done
[[ $EUID != 0 && $(id -un) == deploy ]] || { printf 'Run as the deploy user\n' >&2; exit 1; }
[[ $repo == backend || $repo == app ]] || exit 2
[[ $operation != resume || ( -z $sha && -z $image ) ]] || exit 2

log() { printf '[%s] [%s] %s\n' "$(date -u +%FT%TZ)" "$repo" "$*" | tee -a "$data/deploy.log"; }
fail() { log "$*" >&2; exit 1; }
[[ -e $data/.cicd-enabled ]] || { printf "CI bootstrap has not been enabled\n" >&2; exit 1; }
exec 9>>"$lock"
if flock -n -E 75 9; then :; else
  rc=$?
  if (( rc == 75 )); then
    log 'skipped: deploy in progress'
    printf 'CI_DEPLOY_RESULT=skipped\n'
    exit 0
  fi
  fail 'Deployment lock is unavailable'
fi

trap 'log "failed at line $LINENO; any deployment pause remains in place" >&2' ERR

# Phase 1B uses rootful Docker through sudo. Use the same credential store
# for pull, inspect and GHCR alias updates. The CI key has a forced command.
docker() { sudo -n /usr/bin/docker "$@"; }

setting() { sed -n "s/^$2=//p" "$1/.env" | tail -n1; }
mode=legacy
if [[ $repo == backend ]]; then
  registry=ghcr.io/cmarin001/dex-orchestrator
  state=$data/.last-known-good
  project=$root
  compose_file=deploy/docker/docker-compose.yml
  services=(worker dashboard mcp)
  audit=$(setting "$root" AUDIT_PATH)
  [[ ${audit:-data/audit.jsonl} =~ ^data/[a-zA-Z0-9_-]+\.jsonl$ ]] || fail 'Invalid AUDIT_PATH'
  journal=$root/${audit:-data/audit.jsonl}
else
  registry=ghcr.io/cmarin001/dex-orchestrator-app
  bff_registry=ghcr.io/cmarin001/dex-orchestrator-app-bff
  state=$data/.last-known-good.app
  project=$app_root
  compose_file=compose.yaml
  services=(dashboard)
  mode=$(setting "$project" VITE_DASHBOARD_AUTH_MODE)
  mode=${mode:-legacy}
  case "$mode" in
    legacy) ;;
    auth0) services+=(bff) ;;
    *) fail 'Invalid frontend authentication mode' ;;
  esac
fi

compose() {
  local version=$1
  shift
  local args=(compose --env-file "$project/.env"
    --env-file /dev/stdin -f "$project/$compose_file")
  printf 'IMAGE_TAG=%s\nDASHBOARD_IMAGE=%s\nBFF_IMAGE=%s\nDEX_UID=%s\nDEX_GID=%s\n' \
    "$registry:$version" "$registry:$version" "${bff_registry:-$registry}:$version" "$(id -u)" "$(id -g)" |
    docker "${args[@]}" "$@"
}

atomic() { printf '%s\n' "$2" > "$1.tmp" && mv -f -- "$1.tmp" "$1"; }
set_pause() {
  nonce=$(od -An -v -t x1 -N16 /dev/urandom | tr -d ' \n') || return 1
  [[ $nonce =~ ^[a-f0-9]{32}$ ]] || return 1
  rm -f -- "$ack" && atomic "$marker" "$nonce"
}
acknowledge() {
  local wait_until=$((SECONDS + $(window ack "$1")))
  while (( SECONDS < wait_until )); do
    if [[ -r $ack && $(<"$ack") == "$nonce" ]]; then return 0; fi
    sleep 2
  done
  return 1
}

if [[ $operation == rollback && -z $image && -z $sha ]]; then
  [[ -r $state ]] || fail 'No independent rollback record'
  sha=$(<"$state")
elif [[ $operation != resume ]]; then
  if [[ -z $sha ]]; then sha=${image##*:}; fi
  [[ -z $image || $image == "$sha" || $image == "$registry:$sha" ]] || fail 'Image does not match the approved repository and SHA'
fi

container_image() {
  docker inspect --format '{{.Config.Image}}' "$1"
}

ids=()
consistent=true
for service in "${services[@]}"; do
  id=$(compose "${sha:-probe}" ps -aq "$service")
  if [[ ! $id =~ ^[a-f0-9]{12,64}$ ]]; then
    consistent=false
    id=""
  fi
  ids+=("$id")
done
ref=""
if [[ -n ${ids[0]} ]]; then ref=$(container_image "${ids[0]}"); fi
prior=${ref##*:}
[[ $prior =~ ^[0-9a-f]{40}$ && $ref == "$registry:$prior" ]] || consistent=false
for i in "${!ids[@]}"; do
  expected=$registry:$prior
  if [[ ${services[i]} == bff ]]; then expected=$bff_registry:$prior; fi
  [[ -n ${ids[i]} && $(container_image "${ids[i]}") == "$expected" ]] || consistent=false
done

backend_interval() {
  local body
  body=$(probe) || return 1
  jq -e --arg sha "$1" '.version == $sha' <<< "$body" >/dev/null || return 1
  interval "$body"
}

if [[ $operation == resume ]]; then
  $consistent || fail 'Service images disagree; restore a known-good release first'
  [[ $repo == backend && -e $marker ]] || fail 'There is no backend deployment pause to clear'
  seconds=$(backend_interval "$prior") || fail 'Current backend probe is unhealthy'
  check_backend "$prior" "${ids[0]}" "$seconds" "$(date -u +%s%3N)" ||
    fail 'Backend did not complete two new cycles; pause retained'
  rm -f -- "$ack" "$marker"
  log 'Operator cleared the deployment pause after verifying worker cycles'
  exit 0
fi

[[ $sha =~ ^[0-9a-f]{40}$ ]] || fail 'Provide a full lowercase git SHA'
if $consistent && [[ $sha == "$prior" && $operation == deploy ]]; then
  log 'No change: the requested SHA is already installed'
  printf 'CI_DEPLOY_RESULT=noop\n'
  exit 0
fi

pull_images() {
  local release=$1 ref label
  for ref in "$registry:$release"; do
    docker manifest inspect "$ref" >/dev/null && docker pull "$ref" >/dev/null || return 1
    label=$(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$ref") || return 1
    [[ $label == "$release" ]] || return 1
  done
  if [[ $repo == app ]]; then
    label=$(docker image inspect --format '{{index .Config.Labels "io.tradekeel.auth-mode"}}' "$registry:$release") || return 1
    [[ $label == "$mode" ]] || return 1
    if [[ $mode == auth0 ]]; then
      ref=$bff_registry:$release
      docker manifest inspect "$ref" >/dev/null && docker pull "$ref" >/dev/null || return 1
      [[ $(docker image inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$ref") == "$release" ]] || return 1
    fi
  fi
}

alias_images() {
  local release=$1 alias=$2
  docker buildx imagetools create --prefer-index=false --tag "$registry:$alias" "$registry:$release" >/dev/null || return 1
  if [[ $repo == app && $mode == auth0 ]]; then
    docker buildx imagetools create --prefer-index=false --tag "$bff_registry:$alias" "$bff_registry:$release" >/dev/null || return 1
  fi
}

stopped_backend() {
  # SIGTERM and infinite grace. An unresponsive transaction is never SIGKILLed.
  local worker
  worker=$(compose "$1" ps -q worker) || return 1
  if [[ -n $worker ]]; then docker stop --timeout -1 "$worker" >/dev/null || return 1; fi
}

swap_and_verify() {
  local release=$1 started worker observed_interval ready
  started=$(date -u +%s%3N) || return 1
  compose "$release" up -d --no-deps --no-build --pull never "${services[@]}" || return 1
  if [[ $repo == app ]]; then check_dashboard "$mode"; return; fi
  worker=$(compose "$release" ps -q worker) || return 1
  [[ -n $worker ]] || return 1
  ready=$((SECONDS + 30))
  while (( SECONDS < ready )); do
    if observed_interval=$(backend_interval "$release" 2>/dev/null); then
      check_backend "$release" "$worker" "$observed_interval" "$started"
      return
    fi
    sleep 2
  done
  return 1
}

record() {
  jq -nc --arg repo "$repo" --arg sha "$1" --arg previous "$2" --arg status "$3" \
    --arg at "$(date -u +%FT%TZ)" '{repo:$repo,sha:$sha,previous_sha:$previous,deployed_at:$at,health:$status}' >> "$data/deploy-log.jsonl"
}

if ! $consistent; then
  [[ $operation == rollback && -r $state && $sha == "$(<"$state")" ]] ||
    fail 'Missing or mixed service images; bootstrap first or restore the recorded rollback SHA'
  if [[ $repo == backend ]]; then
    [[ -e $marker && -r $data/.deploy-loop-interval ]] || fail 'Missing deployment recovery state'
    seconds=$(<"$data/.deploy-loop-interval")
    jq -en --argjson loop "$seconds" '$loop > 0 and $loop <= 2147483.647' >/dev/null
    set_pause
    if [[ -n ${ids[0]} && $(docker inspect --format '{{.State.Running}}' "${ids[0]}") == true ]]; then
      acknowledge "$seconds" || fail 'Worker did not acknowledge; rollback requires investigation'
    fi
  fi
  pull_images "$sha" || fail 'Recorded rollback image unavailable'
  if [[ $repo == backend ]]; then stopped_backend "$sha" || fail 'Worker did not stop cleanly'; fi
  if swap_and_verify "$sha" && alias_images "$sha" production && alias_images "$sha" rollback; then
    record "$sha" "" rolled_back
    log "Restored the recorded rollback version $sha"
    printf 'CI_DEPLOY_RESULT=deployed\n'
    exit 0
  fi
  fail 'Recorded rollback failed; operator intervention required'
fi

if [[ $repo == backend ]]; then
  if [[ -e $marker && $operation == deploy ]]; then fail 'Outstanding deployment pause; review and run --resume or --rollback'; fi
  seconds=$(backend_interval "$prior") || fail 'Existing release must expose the unauthenticated local cycle probe'
  atomic "$data/.deploy-loop-interval" "$seconds"
  set_pause
  log 'Awaiting worker acknowledgment before swapping containers'
  acknowledge "$seconds" || fail 'Worker did not acknowledge; containers left running'
  cp -- "$journal" "$journal.pre-$sha.tmp"
  jq -c . "$journal.pre-$sha.tmp" >/dev/null || fail 'Snapshot contains an incomplete journal record; retry after review'
  mv -- "$journal.pre-$sha.tmp" "$journal.pre-$sha"
fi

pull_images "$sha" || fail 'Requested image unavailable or version/auth mode mismatch'
pull_images "$prior" && alias_images "$prior" rollback || fail 'Previous image could not be pinned for rollback'
if [[ $operation == deploy ]]; then atomic "$state" "$prior"; fi

log "Swapping $prior to $sha"
if [[ $repo == backend ]]; then stopped_backend "$prior" || fail 'Worker did not stop cleanly'; fi
if swap_and_verify "$sha" && alias_images "$sha" production; then
  if [[ $operation == rollback && -z $image && -z $sha ]]; then alias_images "$sha" rollback || fail 'Rollback ran but its registry alias could not be recorded'; fi
  record "$sha" "$prior" pass
  if [[ $repo == backend && $operation == deploy ]]; then rm -f -- "$ack" "$marker"; fi
  if [[ $repo == backend && $operation == rollback ]]; then log "Rollback verified for $sha; pause retained";
  else log "Health checks passed for $sha"; fi
  printf 'CI_DEPLOY_RESULT=deployed\n'
  exit 0
fi

log "Deployment $sha failed; attempting one rollback to $prior"
if [[ $repo == backend ]]; then stopped_backend "$sha" || fail 'Worker did not stop cleanly; rollback blocked'; fi
if swap_and_verify "$prior" && alias_images "$prior" production && alias_images "$prior" rollback; then
  record "$prior" "$sha" rolled_back
  if [[ $repo == backend ]]; then fail 'Rollback verified; backend pause requires operator review and resume'; fi
  fail 'Dashboard rollback verified'
fi
record "$prior" "$sha" rollback_failed
fail 'Rollback failed; operator intervention required'
