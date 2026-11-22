#!/usr/bin/env bash
set -euo pipefail
source deploy/cicd/healthcheck.sh
[[ $(window ack 60) == 180 ]]
[[ $(window health 60) == 150 ]]
[[ $(window ack 90) == 270 ]]
[[ $(window health 90) == 210 ]]
[[ $(window ack 5) == 90 ]]
[[ $(window health 5) == 120 ]]
[[ $(interval '{"ok":true,"journal_readable":true,"loop_interval_sec":90}') == 90 ]]
if interval '{"ok":true,"journal_readable":false,"loop_interval_sec":90}'; then exit 1; fi
if interval '{"ok":true,"journal_readable":true,"loop_interval_sec":"90"}'; then exit 1; fi

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
sha=0000000000000000000000000000000000000001
docker() { printf 'true false\n'; }
sleep() { :; }
probe() {
  local attempt date
  attempt=$(<"$tmp/probes")
  printf '%d\n' "$((attempt + 1))" > "$tmp/probes"
  case "$attempt" in
    0) date=2026-01-01T00:00:00.000Z ;;
    1) date=2026-01-01T00:01:00.000Z ;; # first post-swap cycle
    2) date=2026-01-01T00:01:01.000Z ;; # too close to the first
    *) date=2026-01-01T00:02:00.000Z ;;
  esac
  jq -nc --arg sha "$sha" --arg at "$date"     '{ok:true,journal_readable:true,version:$sha,last_cycle_at:$at,loop_interval_sec:60}'
}
printf '0\n' > "$tmp/probes"
check_backend "$sha" worker 60 "$(date -u -d '2026-01-01T00:00:30Z' +%s%3N)"
[[ $(<"$tmp/probes") == 4 ]]
printf 'Deploy timing and fresh-cycle checks passed.\n'
