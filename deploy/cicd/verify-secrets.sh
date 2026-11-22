#!/usr/bin/env bash
set +x
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/lib/wallet-log.sh"
wallet_log_init wallet_verifier
wallet_log info wallet.verify prerequisites started read_only_verification
[[ $EUID -eq 0 ]] || { wallet_log warn wallet.verify prerequisites blocked not_root; printf 'Run as root (sudo).\n' >&2; exit 1; }
repo=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
secrets=$repo/secrets
validator=$repo/tools/derive/derive-address.mjs
[[ -f $validator && ! -L $secrets && -d $secrets && $(stat -c '%a:%U:%G' "$secrets") == 700:deploy:deploy ]] ||
  { wallet_log error wallet.verify prerequisites failed tooling_or_directory_invalid; printf 'FAIL tooling or secrets directory ownership/permissions\n' >&2; exit 1; }
failed=0
check() {
  local file=$secrets/$1
  [[ -f $file && ! -L $file && $(stat -c '%a:%U:%G' "$file") == 600:deploy:deploy ]]
}
for pair in evm:evm_private_key.txt solana:solana_private_key.txt bitcoin_segwit:bitcoin_segwit_private_key.txt; do
  file=${pair#*:}
  if ! check "$file"; then
    wallet_log warn wallet.verify signer_file failed invalid_file_type_owner_or_mode "${pair%:*}"
    printf 'FAIL %s\n' "$file"; failed=1
  elif runuser -u deploy -- bash -c 'exec node "$1" check-secret --kind "$2" < "$3"' \
    verify "$validator" "${pair%:*}" "$secrets/$file"; then
    wallet_log info wallet.verify signer_file ok owner_mode_and_address_verified "${pair%:*}"
    printf 'PASS %s\n' "$file"
  else wallet_log warn wallet.verify signer_file failed signer_address_check_failed "${pair%:*}"
    printf 'FAIL %s\n' "$file"; failed=1; fi
done
if check addresses.json && cmp -s "$secrets/addresses.json" "$repo/data/wallet-addresses.json" &&
   jq -e '.solana.derivation_path as $p | .solana.candidate_paths | index($p) != null' "$secrets/addresses.json" >/dev/null &&
   diff -q <(jq -S 'del(.solana.derivation_path)' "$secrets/addresses.json") \
           <(jq -S 'del(.solana.derivation_path)' "$repo/deploy/cicd/addresses.json") >/dev/null; then
  wallet_log info wallet.verify provisioning_record ok expected_manifest_and_solana_path_match
  printf 'PASS addresses.json\n'
else wallet_log warn wallet.verify provisioning_record failed manifest_permissions_or_content_mismatch
  printf 'FAIL addresses.json\n'; failed=1; fi
for file in master_mnemonic.txt bitcoin_mnemonic.txt; do
  if [[ -e $secrets/$file || -L $secrets/$file ]]; then
    wallet_log warn wallet.verify legacy_file failed obsolete_file_present
    printf 'FAIL obsolete mnemonic file exists: %s\n' "$file"; failed=1
  fi
done
if (( failed )); then wallet_log warn wallet.verify completion failed one_or_more_checks_failed
else wallet_log info wallet.verify completion ok all_checks_passed; fi
exit "$failed"
