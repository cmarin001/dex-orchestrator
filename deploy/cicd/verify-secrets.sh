#!/usr/bin/env bash
set +x
set -euo pipefail
[[ $EUID -eq 0 ]] || { printf 'Run as root (sudo).\n' >&2; exit 1; }
repo=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
secrets=$repo/secrets
validator=$repo/tools/derive/derive-address.mjs
[[ -f $validator && ! -L $secrets && -d $secrets && $(stat -c '%a:%U:%G' "$secrets") == 700:deploy:deploy ]] ||
  { printf 'FAIL tooling or secrets directory ownership/permissions\n' >&2; exit 1; }
failed=0
check() {
  local file=$secrets/$1
  [[ -f $file && ! -L $file && $(stat -c '%a:%U:%G' "$file") == 600:deploy:deploy ]]
}
for pair in evm:evm_private_key.txt solana:solana_private_key.txt bitcoin_segwit:bitcoin_segwit_private_key.txt; do
  file=${pair#*:}
  if check "$file" && runuser -u deploy -- bash -c 'exec node "$1" check-secret --kind "$2" < "$3"' \
    verify "$validator" "${pair%:*}" "$secrets/$file"; then
    printf 'PASS %s\n' "$file"
  else printf 'FAIL %s\n' "$file"; failed=1; fi
done
if check addresses.json && cmp -s "$secrets/addresses.json" "$repo/data/wallet-addresses.json" &&
   jq -e '.solana.derivation_path as $p | .solana.candidate_paths | index($p) != null' "$secrets/addresses.json" >/dev/null &&
   diff -q <(jq -S 'del(.solana.derivation_path)' "$secrets/addresses.json") \
           <(jq -S 'del(.solana.derivation_path)' "$repo/deploy/cicd/addresses.json") >/dev/null; then
  printf 'PASS addresses.json\n'
else printf 'FAIL addresses.json\n'; failed=1; fi
for file in master_mnemonic.txt bitcoin_mnemonic.txt; do
  if [[ -e $secrets/$file || -L $secrets/$file ]]; then printf 'FAIL obsolete mnemonic file exists: %s\n' "$file"; failed=1; fi
done
exit "$failed"
