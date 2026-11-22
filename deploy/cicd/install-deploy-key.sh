#!/usr/bin/env bash
set -euo pipefail
umask 077
[[ $(id -un) == deploy && $EUID != 0 ]] || { printf 'Run as deploy\n' >&2; exit 1; }
[[ ${1:-} == backend || ${1:-} == app ]] || { printf 'Usage: install-deploy-key.sh backend|app < KEY.pub\n' >&2; exit 2; }
IFS= read -r line
if IFS= read -r extra; then printf 'Supply one public key only\n' >&2; exit 2; fi
read -r type key _ <<< "$line"
[[ $type == ssh-ed25519 && $key =~ ^[a-zA-Z0-9+/]+={0,2}$ ]] || { printf 'Expected an Ed25519 public key\n' >&2; exit 2; }
printf '%s %s\n' "$type" "$key" | ssh-keygen -lf /dev/stdin >/dev/null
install -d -m700 "$HOME/.ssh"
touch "$HOME/.ssh/authorized_keys"
chmod 600 "$HOME/.ssh/authorized_keys"
if grep -Fq "$key" "$HOME/.ssh/authorized_keys"; then printf 'Key already exists\n' >&2; exit 1; fi
printf 'restrict,command="/opt/dex-orchestrator/deploy/cicd/ssh-deploy.sh %s" %s %s\n' \
  "$1" "$type" "$key" >> "$HOME/.ssh/authorized_keys"
# Read the actual local host key so enrollment is independent of network DNS.
read -r host_type host_key _ < /etc/ssh/ssh_host_ed25519_key.pub
printf 'DROPLET_HOST_KEY=dex-orchestrator.best %s %s\n' "$host_type" "$host_key"
