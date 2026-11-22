#!/usr/bin/env bash
# All fields are fixed call-site strings, validated wallet kinds or generated IDs.
wallet_log() {
  local level=$1 event=$2 stage=$3 outcome=$4 reason=$5 kind=${6:-none}
  local line
  printf -v line '{"at":"%s","level":"%s","event":"%s","component":"%s","operation_id":"%s","stage":"%s","outcome":"%s","reason":"%s","kind":"%s","duration_ms":%d}' \
    "$(date -u +%FT%TZ)" "$level" "$event" "$wallet_component" "$wallet_operation_id" \
    "$stage" "$outcome" "$reason" "$kind" "$(( (SECONDS - wallet_started) * 1000 ))" 2>/dev/null
  printf '%s\n' "$line" >&2
  if command -v logger >/dev/null; then
    logger -t tradekeel-wallet -- "$line" || printf '%s\n' '{"level":"warn","event":"wallet.log_sink_unavailable"}' >&2
  fi
}
wallet_log_init() {
  wallet_component=$1
  read -r wallet_operation_id < /proc/sys/kernel/random/uuid
  export DEX_WALLET_OPERATION_ID="$wallet_operation_id"
  wallet_started=$SECONDS
}
