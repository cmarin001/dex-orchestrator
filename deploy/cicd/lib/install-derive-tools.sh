#!/usr/bin/env bash
set -euo pipefail
repo=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)
tools=$repo/tools/derive
# Install the repository's pinned graph as the unprivileged deployment user.
if [[ -r $tools/package-lock.json ]] && cmp -s "$repo/package-lock.json" "$tools/package-lock.json" &&
   [[ -f $tools/node_modules/@noble/ed25519/package.json && -f $tools/node_modules/@scure/btc-signer/package.json ]]; then
  exit 0
fi
install -d -m 700 "$tools"
install -m 600 "$repo/package.json" "$repo/package-lock.json" "$tools/"
npm ci --prefix "$tools" --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error
