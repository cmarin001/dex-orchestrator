#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077
[[ $EUID -eq 0 ]] || { printf 'Run as root (sudo).\n' >&2; exit 1; }
[[ $# -eq 0 || ( $# -eq 1 && $1 == --force ) ]] || { printf 'Usage: setup-secrets.sh [--force]\n' >&2; exit 2; }
[[ -t 0 && -t 2 ]] || { printf 'Run from a local droplet console with a TTY.\n' >&2; exit 1; }
command -v whiptail >/dev/null || { printf 'Install whiptail with apt install whiptail.\n' >&2; exit 1; }
command -v jq >/dev/null || { printf 'Install jq with apt install jq.\n' >&2; exit 1; }
repo=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
[[ $repo == /opt/dex-orchestrator ]] || { printf 'Run the installed copy under /opt/dex-orchestrator.\n' >&2; exit 1; }
manifest=$repo/deploy/cicd/addresses.json
secrets=$repo/secrets
[[ -f $manifest && ! -L $manifest && ! -L $secrets && ! -L $repo/data ]] || exit 1
install -d -m 700 -o deploy -g deploy "$secrets" "$repo/data"
[[ -f /var/lock/dex-deploy.lock && ! -L /var/lock/dex-deploy.lock ]] ||
  { printf 'Install the droplet deployment lock first.\n' >&2; exit 1; }
exec 9>>/var/lock/dex-deploy.lock
flock -n 9 || { printf 'Deployment or provisioning is active.\n' >&2; exit 1; }
# A mounted secret keeps its old inode until the worker is recreated.
worker=$(docker ps -q --filter label=com.docker.compose.project=dex-orchestrator --filter label=com.docker.compose.service=worker)
[[ -z $worker ]] || { printf 'Stop the worker in its maintenance window before provisioning.\n' >&2; exit 1; }
names=(evm_private_key.txt solana_private_key.txt bitcoin_segwit_private_key.txt addresses.json)
overwrite=false
for name in "${names[@]}" master_mnemonic.txt bitcoin_mnemonic.txt; do
  path=$secrets/$name
  if [[ -L $path || ( -e $path && ! -f $path ) ]]; then printf 'Unsafe secret destination.\n' >&2; exit 1; fi
  if [[ -f $path ]] && ! cmp -s "$path" <(printf "<REPLACE_WITH_SECRET>\n"); then overwrite=true; fi
done
if $overwrite; then
  [[ ${1:-} == --force ]] || { printf 'Existing wallet files. Re-run with --force after review.\n' >&2; exit 1; }
  known=$manifest
  if [[ -f $secrets/addresses.json ]]; then known=$secrets/addresses.json; fi
  current=$(jq -er '[.evm.address,.solana.address,.bitcoin_segwit.address] | map(select(type == "string" and test("^[A-Za-z0-9]+$"))) | join("\n")' "$known")
  confirm=$(whiptail --inputbox "Replace signer files for these addresses?\n$current\nType OVERWRITE to continue." 15 76 3>&1 1>&2 2>&3) || exit 1
  [[ $confirm == OVERWRITE ]] || exit 1
fi
runuser -u deploy -- bash "$repo/deploy/cicd/lib/install-derive-tools.sh"
stage=$(mktemp -d "$secrets/.wallet-stage.XXXXXXXX")
committed=false
changed=()
public_stage=''
cleanup() {
  unset MNEMONIC
  if ! $committed; then
    for name in "${changed[@]}"; do
      if [[ -f $stage/backups/$name ]]; then mv -fT -- "$stage/backups/$name" "$secrets/$name" || return; else rm -f -- "$secrets/$name" || return; fi
    done
  fi
  rm -rf -- "$stage"
  if [[ -n $public_stage ]]; then rm -f -- "$public_stage"; fi
}
trap cleanup EXIT
trap 'exit 1' HUP INT TERM
mkdir "$stage/backups"
chgrp deploy "$stage"
chmod 0710 "$stage"
install -d -m 700 -o deploy -g deploy "$stage/keys"
validator=$repo/deploy/cicd/lib/derive-address.mjs
# Install a copy beside the pinned graph without routing secrets through npm.
runuser -u deploy -- install -m 600 "$validator" "$repo/tools/derive/derive-address.mjs"
runuser -u deploy -- install -m 600 "$manifest" "$repo/tools/derive/addresses.json"
validator=$repo/tools/derive/derive-address.mjs
unset MNEMONIC
MNEMONIC=$(whiptail --passwordbox 'Enter the dedicated wallet recovery phrase.' 10 76 3>&1 1>&2 2>&3) || exit 1
if verification=$(printf '%s' "$MNEMONIC" | runuser -u deploy -- node "$validator" validate); then
  printf '%s\n' "$verification"
else
  printf '%s\n' "$verification"
  whiptail --msgbox 'Address verification failed. Signer files were not changed.' 8 65
  exit 1
fi
path=$(sed -n 's/^MATCH //p' <<< "$verification")
[[ -n $path ]] || exit 1
addresses=$(sed -n 's/^OK //p' <<< "$verification")
whiptail --defaultno --yesno "Provision three signer files? Verified public addresses:\n$addresses" 15 76 || exit 1
kinds=(evm solana bitcoin_segwit)
for i in 0 1 2; do
  printf '%s' "$MNEMONIC" | runuser -u deploy -- node "$validator" write-secret --kind "${kinds[i]}" --path "$stage/keys/${names[i]}"
done
unset MNEMONIC
jq --arg path "$path" '.solana.derivation_path = $path' "$manifest" > "$stage/addresses.json"
chown deploy:deploy "$stage/addresses.json"
public_stage=$(mktemp "$repo/data/.wallet-addresses.XXXXXXXX")
install -m 600 -o deploy -g deploy "$stage/addresses.json" "$public_stage"
for name in "${names[@]}" master_mnemonic.txt bitcoin_mnemonic.txt; do
  if [[ -f $secrets/$name ]]; then ln -- "$secrets/$name" "$stage/backups/$name"; fi
done
for name in "${names[@]}"; do
  source_file=$stage/keys/$name
  if [[ $name == addresses.json ]]; then source_file=$stage/$name; fi
  [[ -f $source_file && ! -L $source_file && $(stat -c %a "$source_file") == 600 ]] || exit 1
  changed+=("$name")
  mv -fT -- "$source_file" "$secrets/$name"
done
# Remove Phase 1B's obsolete mnemonic mount source only after validation.
for name in master_mnemonic.txt bitcoin_mnemonic.txt; do
  changed+=("$name")
  rm -f -- "$secrets/$name"
done
mv -fT -- "$public_stage" "$repo/data/wallet-addresses.json"
committed=true
printf '\nPre-funding checklist\n'
printf '%s\n' '[ ] Compare all four public addresses with your offline wallet.' \
  '[ ] Run verify-secrets.sh and deploy/scripts/99-verify.sh.' \
  '[ ] Recreate the worker in paper mode and verify the signer configuration.' \
  '[ ] Follow the chain and funding checklist in docs/secrets-runbook.md.'
