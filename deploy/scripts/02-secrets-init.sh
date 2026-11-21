#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
require_deploy
umask 077
[[ ! -L $secrets ]] || die 'Secrets directory must be a real directory.'
install -d -m 0700 "$secrets"
for name in "${secret_names[@]}"; do
  path="$secrets/$name.txt"
  [[ ! -L $path ]] || die "Unexpected symlink: $path"
  if [[ ! -e $path && ${1:-} != --check ]]; then
    if [[ $name == dashboard_api_token ]]; then
      (set -o noclobber; openssl rand -hex 32 >"$path")
    else
      (set -o noclobber; printf '%s\n' "$placeholder" >"$path")
    fi
  fi
  [[ -f $path && -O $path ]] || die "Secret file missing or owned by another user: $path"
  if [[ ${1:-} == --check ]]; then
    [[ $(stat -c %a "$path") == 600 ]] || die "Secret file must be mode 600: $path"
  else
    chmod 0600 "$path"
  fi
done
printf 'Now populate any required wallet key files by hand. Do NOT paste keys into a chat, a log, or a shell history.\n'
secrets_ready
