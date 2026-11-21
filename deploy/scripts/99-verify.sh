#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

failed=0
check() {
  local title=$1
  shift
  if "$@"; then printf 'PASS: %s\n' "$title" >&2
  else printf 'FAIL: %s — check failed\n' "$title" >&2; failed=1
  fi
}
valid_ipv4() {
  local part
  [[ $1 =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || return 1
  IFS=. read -ra parts <<< "$1"
  for part in "${parts[@]}"; do (( 10#$part <= 255 )) || return 1; done
}
outside_closed() {
  local code connects
  code=0
  connects=$(curl --noproxy '*' --connect-timeout 4 --max-time 5 -s -o /dev/null -w '%{num_connects}' "http://$ip:$1/") || code=$?
  [[ $connects == 0 && ( $code == 7 || $code == 28 ) ]]
}
rejected_ssh() {
  local login=$1
  shift
  local result
  result=$(ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=5 "$@" "$login@$ip" true 2>&1) && return 1
  grep -Eq 'Permission denied \(publickey\)\.$' <<< "$result"
}

if [[ ${1:-} == --external ]]; then
  domain=${2:-}; ip=${3:-}
  valid_domain "$domain" && valid_ipv4 "$ip" || die 'Usage: 99-verify.sh --external DOMAIN PUBLIC_IPV4'
  check 'Root key login rejected from outside' rejected_ssh root -o PasswordAuthentication=no -o KbdInteractiveAuthentication=no
  check 'Password login rejected from outside' rejected_ssh deploy -o PubkeyAuthentication=no -o PreferredAuthentications=password,keyboard-interactive
  check 'Public port 8787 blocked' outside_closed 8787
  check 'Public port 3001 blocked' outside_closed 3001
  check 'Public TLS and status page' curl --noproxy '*' --resolve "$domain:443:$ip" --max-time 8 --fail --silent --show-error -o /dev/null "https://$domain/"
  hsts() {
    curl --noproxy '*' --resolve "$domain:443:$ip" --max-time 8 -fsSI "https://$domain/" |
      grep -Eiq '^strict-transport-security: max-age=31536000; includeSubDomains'
  }
  check 'Public HSTS' hsts
  (( failed == 0 )) || exit 1
  printf 'external-v1 %s %s %s\n' "$domain" "$ip" "$(date +%s)"
  exit 0
fi

require_root
domain=${1:-}; ip=${2:-}; proof=${3:-}
valid_domain "$domain" && valid_ipv4 "$ip" && [[ -r $proof ]] ||
  die 'Usage: sudo 99-verify.sh DOMAIN PUBLIC_IPV4 EXTERNAL_PROOF'
cd "$repo"
verification=/var/lib/dex-orchestrator/verified
rm -f -- "$verification"
ssh_policy() {
  local output
  output=$(sshd -T -C "user=$1,host=$domain,addr=$ip") || return 1
  grep -Fxq "$2" <<< "$output"
}
verify_outside() {
  local kind name addr time extra
  read -r kind name addr time extra <"$proof" || return 1
  [[ $kind == external-v1 && $name == "$domain" && $addr == "$ip" && -z $extra && $time =~ ^[0-9]{10}$ ]] || return 1
  local age=$(( $(date +%s) - 10#$time ))
  (( age >= -60 && age <= 3600 ))
}
firewall_ports() {
  local policy
  policy=$(LC_ALL=C ufw status) || return 1
  for port in 22 80 443; do grep -Eq "^$port/tcp[[:space:]]+ALLOW" <<< "$policy" || return 1; done
  awk '/ALLOW[[:space:]]*(IN)?[[:space:]]/ && $1 !~ /^(22|80|443)\/tcp$/ {bad=1} END {exit bad}' <<< "$policy"
}
services_running() {
  local names
  names=$(compose ps --services --filter status=running) || return 1
  [[ $(sort <<< "$names") == $'dashboard\nmcp\nworker' ]]
}
published_ports() {
  local id payload
  id=$(compose ps -q "$1") || return 1
  [[ -n $id ]] || return 1
  payload=$(docker inspect --format '{{json .HostConfig.PortBindings}}' "$id") || return 1
  if [[ $# == 1 ]]; then jq -e 'length == 0' <<< "$payload" >/dev/null
  else jq -e --arg port "$2" 'length == 1 and .[$port+"/tcp"] == [{HostIp:"127.0.0.1",HostPort:$port}]' <<< "$payload" >/dev/null; fi
}
status_code() {
  curl --noproxy '*' --resolve "$domain:443:127.0.0.1" --max-time 8 -sS -o /dev/null -w '%{http_code}' "$@" "https://$domain/api/v1/status"
}
auth_unauthenticated() { [[ $(status_code) == 401 ]]; }
auth_authenticated() {
  local token
  token=$(<"$secrets/dashboard_api_token.txt")
  [[ $token =~ ^[a-f0-9]{64}$ ]] || return 1
  [[ $(printf 'Authorization: Bearer %s\n' "$token" | status_code -H @-) == 200 ]]
}
inspect_env() {
  local id payload service
  for service in worker dashboard mcp; do
    id=$(compose ps -q "$service") || return 1
    payload=$(docker inspect --format '{{json .Config.Env}}' "$id") || return 1
    jq -e 'all(.[]; test("^[A-Za-z_0-9]*(PRIVATE_KEY|MNEMONIC|API_KEY|ACCESS_KEY|ACCESS_TOKEN|BEARER_TOKEN|API_TOKEN|SECRET_KEY|SESSION_TOKEN|RPC_URL|PASSWORD)=")|not)'       <<< "$payload" >/dev/null || return 1
  done
}
secret_mounts() {
  local service name expected id payload
  for service in worker dashboard mcp; do
    id=$(compose ps -q "$service") || return 1
    payload=$(docker inspect --format '{{json .Mounts}}' "$id") || return 1
    if [[ $service == worker ]]; then
      expected=$(printf '%s\n' "${secret_names[@]}" | sed '/^dashboard_api_token$/d' | sort)
    else expected=dashboard_api_token; fi
    [[ $(jq -r '.[] | select(.Destination|startswith("/run/secrets/")) | select(.RW == false) | .Destination | split("/") | last' <<< "$payload" | sort) == "$expected" ]] ||
      return 1
    while IFS= read -r name; do
      compose exec -T "$service" test -r "/run/secrets/$name" || return 1
    done <<< "$expected"
  done
}
secret_permissions() {
  local name path
  [[ -d $secrets && ! -L $secrets && $(stat -c '%a:%U' "$secrets") == 700:deploy ]] || return 1
  for name in "${secret_names[@]}"; do
    path="$secrets/$name.txt"
    [[ -f $path && ! -L $path && $(stat -c '%a:%U' "$path") == 600:deploy ]] || return 1
  done
  secrets_ready
}
paper_soak() {
  [[ $(setting OPERATING_MODE) == strategies && $(setting EXECUTION_MODE) == paper ]] || return 1
  local id payload started epoch audit
  id=$(compose ps -q worker) || return 1
  payload=$(docker inspect --format '{{json .State}}' "$id") || return 1
  jq -e '.Running and (.Health.Status=="healthy")' <<< "$payload" >/dev/null || return 1
  started=$(jq -er '.StartedAt' <<< "$payload") || return 1
  epoch=$(date -d "$started" +%s) || return 1
  (( $(date +%s) - epoch >= 172800 )) || return 1
  audit=$(setting AUDIT_PATH)
  [[ ${audit:-data/audit.jsonl} =~ ^data/[A-Za-z0-9_-]+\.jsonl$ ]] || return 1
  jq -es --arg started "${started:0:19}" '
    [.[] | select(.at[0:19] >= $started)] |
    ([.[] | select(.status=="paper_fill")] | length >= 5) and
    any(.[]; .status=="skipped") and
    all(.[]; .stage!="model_provider" and .status!="live_fill" and .status!="live_close")
  ' "$repo/${audit:-data/audit.jsonl}" >/dev/null
}
restarts_from_journal() {
  # Stop paper first so the snapshot is taken after in-flight appends drain.
  compose stop worker >/dev/null || return 1
  local expected actual since
  if ! expected=$(compose run --rm --no-deps -T worker node dist/health.js --positions); then
    compose start worker >/dev/null || true
    return 1
  fi
  since=$(date +%s%3N)
  compose start worker >/dev/null || return 1
  for _ in {1..30}; do
    if actual=$(compose exec -T worker node dist/health.js --replay "$since" 2>/dev/null); then
      [[ $actual == "$expected" ]]
      return
    fi
    sleep 1
  done
  return 1
}

check 'SSH root login disabled' ssh_policy root 'permitrootlogin no'
check 'SSH password authentication disabled' ssh_policy deploy 'passwordauthentication no'
check 'UFW active' bash -c 'LC_ALL=C ufw status | grep -Fxq "Status: active"'
check 'UFW ingress allowlist' firewall_ports
check 'Fail2ban SSH jail' fail2ban-client status sshd >/dev/null
check 'Three Compose services running' services_running
check 'Worker publishes no ports' published_ports worker
check 'Dashboard bound only on loopback' published_ports dashboard 8787
check 'MCP bound only on loopback' published_ports mcp 3001
check 'Recent external checks cover SSH, blocked ports, TLS and HSTS' verify_outside
if auth_unauthenticated; then
  printf 'PASS: dashboard requires bearer authentication\n' >&2
  check 'Dashboard works with the mounted token through Nginx' auth_authenticated
else
  printf 'FAIL: dashboard requires bearer authentication — expected HTTP 401; authenticated probe skipped\n' >&2
  failed=1
fi
check 'Credentials absent from container environment' inspect_env
check 'Only the assigned read-only secret files are mounted' secret_mounts
check 'Secret files have owner deploy and mode 600' secret_permissions
check 'Deployment environment file has mode 600' test "$(stat -c %a .env 2>/dev/null || true)" = 600
check '.env contains configuration and no credential assignments' env_has_no_secrets
worker_logs() { compose logs --no-color worker | compose exec -T worker node dist/health.js --check-logs; }
check 'No mounted credential values or recognizable API keys in retained worker logs' worker_logs
check '48-hour zero-model paper soak with at least five fills and skips' paper_soak

if (( failed == 0 )); then
  check 'Worker restart restores the same paper position keys' restarts_from_journal
else
  printf 'FAIL: journal restart verification — prerequisite checks failed; worker was left running\n' >&2
fi
(( failed == 0 )) || exit 1

# Root-owned result consumed by the live deploy check. Reverification ages out.
install -d -m 0755 /var/lib/dex-orchestrator
revision=$(sudo -u deploy git -C "$repo" rev-parse HEAD)
[[ $revision =~ ^[a-f0-9]{40}$ ]] || die "Cannot identify the verified revision."
printf '%s %s\n' "$revision" "$(date +%s)" >"$verification"
chmod 0644 "$verification"
