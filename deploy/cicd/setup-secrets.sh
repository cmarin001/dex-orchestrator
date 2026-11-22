#!/usr/bin/env bash
set +x
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/lib/wallet-log.sh"
wallet_log_init wallet_provisioner
stage_name=prerequisites
trap 'wallet_log error wallet.provision "$stage_name" failed command_failed' ERR
refuse() { wallet_log warn wallet.provision "$stage_name" blocked "$1"; printf "%s\n" "$2" >&2; exit 1; }
wallet_log info wallet.provision "$stage_name" started interactive_setup
umask 077
[[ $EUID -eq 0 ]] || refuse not_root "Run as root (sudo)."
[[ $# -eq 0 || ( $# -eq 1 && $1 == --force ) ]] || refuse invalid_arguments "Usage: setup-secrets.sh [--force]"
[[ -t 0 && -t 2 ]] || refuse tty_required "Run from a local droplet console with a TTY."
command -v whiptail >/dev/null || refuse whiptail_missing "Install whiptail with apt install whiptail."
command -v jq >/dev/null || refuse jq_missing "Install jq with apt install jq."
repo=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
[[ $repo == /opt/dex-orchestrator ]] || refuse wrong_installation "Run the installed copy under /opt/dex-orchestrator."
manifest=$repo/deploy/cicd/addresses.json
secrets=$repo/secrets
[[ -f $manifest && ! -L $manifest && ! -L $secrets && ! -L $repo/data ]] || refuse unsafe_path "Unsafe manifest or wallet directory."
install -d -m 700 -o deploy -g deploy "$secrets" "$repo/data"
[[ -f /var/lock/dex-deploy.lock && ! -L /var/lock/dex-deploy.lock ]] ||
  refuse lock_missing_or_unsafe "Install the droplet deployment lock first."
stage_name=maintenance_lock
exec 9>>/var/lock/dex-deploy.lock
flock -n 9 || refuse lock_busy "Deployment or provisioning is active."
# A mounted secret keeps its old inode until the worker is recreated.
worker=$(docker ps -q --filter label=com.docker.compose.project=dex-orchestrator --filter label=com.docker.compose.service=worker)
[[ -z $worker ]] || refuse worker_running "Stop the worker in its maintenance window before provisioning."
wallet_log info wallet.provision "$stage_name" ok worker_stopped_lock_acquired
stage_name=overwrite_check
names=(evm_private_key.txt solana_private_key.txt bitcoin_segwit_private_key.txt addresses.json)
overwrite=false
for name in "${names[@]}" master_mnemonic.txt bitcoin_mnemonic.txt; do
  path=$secrets/$name
  if [[ -L $path || ( -e $path && ! -f $path ) ]]; then refuse unsafe_destination "Unsafe secret destination."; fi
  if [[ -f $path ]] && ! cmp -s "$path" <(printf "<REPLACE_WITH_SECRET>\n"); then overwrite=true; fi
done
if $overwrite; then
  [[ ${1:-} == --force ]] || refuse existing_wallet "Existing wallet files. Re-run with --force after review."
  known=$manifest
  if [[ -f $secrets/addresses.json ]]; then known=$secrets/addresses.json; fi
  current=$(jq -er '[.evm.address,.solana.address,.bitcoin_segwit.address] | map(select(type == "string" and test("^[A-Za-z0-9]+$"))) | join("\n")' "$known")
  confirm=$(whiptail --inputbox "Replace signer files for these addresses?\n$current\nType OVERWRITE to continue." 15 76 3>&1 1>&2 2>&3) ||
    refuse overwrite_declined "Overwrite was not confirmed."
  [[ $confirm == OVERWRITE ]] || refuse overwrite_declined "Overwrite was not confirmed."
  wallet_log info wallet.provision "$stage_name" ok overwrite_confirmed
fi
stage_name=tool_install
wallet_log info wallet.provision "$stage_name" started pinned_npm_dependencies
runuser -u deploy -- bash "$repo/deploy/cicd/lib/install-derive-tools.sh"
wallet_log info wallet.provision "$stage_name" ok dependencies_ready
stage=$(mktemp -d "$secrets/.wallet-stage.XXXXXXXX")
committed=false
changed=()
public_stage=''
cleanup() {
  unset MNEMONIC
  if ! $committed && (( ${#changed[@]} )); then
    wallet_log warn wallet.provision cleanup started restore_previous_files
    for name in "${changed[@]}"; do
      if [[ -f $stage/backups/$name ]]; then mv -fT -- "$stage/backups/$name" "$secrets/$name" || return; else rm -f -- "$secrets/$name" || return; fi
    done
  fi
  if ! $committed && (( ${#changed[@]} )); then wallet_log info wallet.provision cleanup ok previous_files_restored; fi
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
stage_name=address_validation
unset MNEMONIC
MNEMONIC=$(whiptail --passwordbox 'Enter the dedicated wallet recovery phrase.' 10 76 3>&1 1>&2 2>&3) ||
  refuse input_cancelled "Secret entry was cancelled."
if verification=$(printf '%s' "$MNEMONIC" | runuser -u deploy -- node "$validator" validate); then
  printf '%s\n' "$verification"
else
  printf '%s\n' "$verification"
  wallet_log warn wallet.provision "$stage_name" blocked derivation_or_address_check_failed
  whiptail --msgbox 'Address verification failed. Signer files were not changed.' 8 65
  exit 1
fi
path=$(sed -n 's/^MATCH //p' <<< "$verification")
[[ -n $path ]] || refuse solana_path_missing "Solana path was not verified."
wallet_log info wallet.provision "$stage_name" ok four_addresses_verified
addresses=$(sed -n 's/^OK //p' <<< "$verification")
whiptail --defaultno --yesno "Provision three signer files? Verified public addresses:\n$addresses" 15 76 || refuse provisioning_declined "Provisioning was not confirmed."
stage_name=stage_signer
kinds=(evm solana bitcoin_segwit)
for i in 0 1 2; do
  wallet_log info wallet.provision "$stage_name" started exclusive_mode_600_write "${kinds[i]}"
  printf '%s' "$MNEMONIC" | runuser -u deploy -- node "$validator" write-secret --kind "${kinds[i]}" --path "$stage/keys/${names[i]}"
  wallet_log info wallet.provision "$stage_name" ok signer_staged "${kinds[i]}"
done
unset MNEMONIC
stage_name=publish
wallet_log info wallet.provision "$stage_name" started publish_signers_and_public_manifest
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
  [[ -f $source_file && ! -L $source_file && $(stat -c %a "$source_file") == 600 ]] ||
    refuse staged_file_invalid "A staged file has an unexpected type or mode."
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
wallet_log info wallet.provision "$stage_name" ok three_signers_and_manifest_published
printf '\nPre-funding checklist\n'
printf '%s\n' '[ ] Compare all four public addresses with your offline wallet.' \
  '[ ] Run verify-secrets.sh and deploy/scripts/99-verify.sh.' \
  '[ ] Recreate the worker in paper mode and verify the signer configuration.' \
  '[ ] Follow the chain and funding checklist in docs/secrets-runbook.md.'
