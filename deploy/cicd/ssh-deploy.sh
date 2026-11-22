#!/usr/bin/env bash
set -euo pipefail
[[ ${1:-} == backend || ${1:-} == app ]] || exit 2
[[ ${SSH_ORIGINAL_COMMAND:-} =~ ^deploy[[:space:]]([a-f0-9]{40})$ ]] || exit 2
exec "$(dirname "${BASH_SOURCE[0]}")/deploy.sh" --repo "$1" --sha "${BASH_REMATCH[1]}"
