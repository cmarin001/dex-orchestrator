#!/usr/bin/env bash
set -euo pipefail

probe() {
  curl --noproxy '*' --fail --silent --show-error --max-time 3 http://127.0.0.1:8787/api/v1/health
}

interval() {
  jq -er 'select(.ok == true and .journal_readable == true) |
    .loop_interval_sec | select(type == "number" and . > 0 and . <= 2147483.647)' <<< "$1"
}

window() {
  jq -nr --argjson loop "$2" --arg kind "$1" '
    if $kind == "ack" then [3 * $loop, 90] else [2 * $loop + 30, 120] end | max | ceil'
}

check_backend() {
  local sha=$1 worker=$2 seconds=$3 started=$4 deadline body cycle ms first=0
  deadline=$((SECONDS + $(window health "$seconds")))
  local min_ms
  min_ms=$(jq -nr --argjson loop "$seconds" '$loop * 1000 | round')
  while (( SECONDS < deadline )); do
    if [[ $(docker inspect --format '{{.State.Running}} {{.State.Restarting}}' "$worker") == 'true false' ]] &&
       body=$(probe 2>/dev/null) &&
       cycle=$(jq -er --arg sha "$sha" --argjson loop "$seconds" '
         select(.ok and .journal_readable and .version == $sha and .loop_interval_sec == $loop)
         | .last_cycle_at | select(type == "string")' <<< "$body") &&
       ms=$(date -u -d "$cycle" +%s%3N) && (( ms >= started )); then
      if (( first == 0 )); then first=$ms
      elif (( ms > first && ms - first >= min_ms )); then return 0
      fi
    fi
    sleep 2
  done
  return 1
}

check_dashboard() {
  local mode=$1 title deadline=$((SECONDS + 60))
  while (( SECONDS < deadline )); do
    if curl --noproxy '*' --fail --silent --max-time 3 http://127.0.0.1:8081/healthz >/dev/null &&
       title=$(curl --noproxy '*' --fail --silent --max-time 3 http://127.0.0.1:8081/) &&
       [[ $title == *'<title>TradeKeel</title>'* ]]; then
      if [[ $mode == legacy ]]; then return 0; fi
      if curl --noproxy '*' --fail --silent --max-time 3 http://127.0.0.1:8082/auth/me |
        jq -e '.authenticated == false' >/dev/null; then return 0; fi
    fi
    sleep 2
  done
  return 1
}

if [[ ${BASH_SOURCE[0]} == "$0" ]]; then
  check_backend "$@"
fi
