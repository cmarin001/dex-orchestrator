#!/usr/bin/env bash

repo=/opt/dex-orchestrator
secrets="$repo/secrets"
compose_file="$repo/deploy/docker/docker-compose.yml"
placeholder='<REPLACE_WITH_SECRET>'
secret_names=(evm_private_key solana_private_key bitcoin_mnemonic openai_api_key dashboard_api_token
  deepseek_api_key xai_api_key live_rpc_url zerox_api_key jupiter_api_key goplus_access_token etherscan_api_key
  x_bearer_token reddit_access_token)

die() { printf 'Error: %s\n' "$1" >&2; exit 1; }
require_root() { [[ $EUID == 0 ]] || die 'Run this script with sudo.'; }
require_deploy() { [[ $(id -un) == deploy ]] || die 'Run this script as deploy without sudo.'; }
setting() {
  local name=$1
  [[ -r "$repo/.env" ]] || return 0
  sed -n "s/^$name=//p" "$repo/.env" | tail -n 1
}

compose() {
  local uid gid
  uid=$(id -u deploy)
  gid=$(id -g deploy)
  local args=(compose --env-file "$repo/.env" -f "$compose_file")
  if [[ $EUID == 0 ]]; then
    env DEX_UID="$uid" DEX_GID="$gid" DEX_DATA_DIR="$repo/data" DEX_SECRETS_DIR="$secrets"       docker "${args[@]}" "$@"
  else
    sudo env DEX_UID="$uid" DEX_GID="$gid" DEX_DATA_DIR="$repo/data" DEX_SECRETS_DIR="$secrets"       docker "${args[@]}" "$@"
  fi
}

required_secrets() {
  [[ $(setting DASHBOARD_AUTH_MODE) == auth0 ]] || printf '%s\n' dashboard_api_token
  local execution chain wallet decision
  execution=$(setting EXECUTION_MODE); chain=$(setting LIVE_CHAIN); wallet=$(setting WALLET_MODE)
  decision=$(setting OPERATING_MODE)
  if [[ $execution == live ]]; then
    printf '%s\n' live_rpc_url
    case ${chain:-base} in
      solana) printf '%s\n' solana_private_key jupiter_api_key ;;
      bitcoin) printf '%s\n' bitcoin_mnemonic ;;
      *) printf '%s\n' zerox_api_key; [[ $wallet == kms ]] || printf '%s\n' evm_private_key ;;
    esac
  fi
  if [[ $decision == ai || $decision == hybrid ]]; then
    local provider
    IFS=, read -ra providers <<< "$(setting MODEL_PROVIDERS)"
    for provider in "${providers[@]}"; do
      case "${provider// /}" in
        openai) printf '%s\n' openai_api_key ;;
        deepseek) printf '%s\n' deepseek_api_key ;;
        grok) printf '%s\n' xai_api_key ;;
      esac
    done
  fi
}

secrets_ready() {
  local name path missing=0
  while IFS= read -r name; do
    path="$secrets/$name.txt"
    if [[ ! -s $path ]] || grep -Fxq -- "$placeholder" "$path" || ! grep -q '[^[:space:]]' "$path"; then
      printf 'Populate %s\n' "$path" >&2
      missing=1
    fi
  done < <(required_secrets)
  (( missing == 0 ))
}

env_has_no_secrets() {
  # Mounted file paths are set by Compose.
  [[ -r "$repo/.env" ]] || return 1
  awk -F= '
    /^[[:space:]]*(#|$)/ {next}
    NF < 2 {bad=1; next}
    {
      key=$1; gsub(/^[[:space:]]*(export[[:space:]]+)?|[[:space:]]+$/, "", key)
      if (key ~ /(PRIVATE_KEY|MNEMONIC|API_KEY|ACCESS_KEY|ACCESS_TOKEN|BEARER_TOKEN|API_TOKEN|SECRET_KEY|CLIENT_SECRET|SESSION_TOKEN|RPC_URL|PASSWORD)$/) bad=1
      if (key !~ /^[A-Za-z_][A-Za-z0-9_]*$/) bad=1
      if (key ~ /^DEX_(UID|GID|SERVICE|DATA_DIR|SECRETS_DIR)$/) bad=1
    }
    END {exit (bad ? 1 : 0)}
  ' "$repo/.env"
}

valid_domain() {
  [[ ${#1} -le 253 && $1 =~ ^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$ ]]
}
