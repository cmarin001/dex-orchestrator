#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
require_root
source /etc/os-release
[[ $ID == ubuntu && $VERSION_ID == 24.04 ]] || die 'This installer targets Ubuntu 24.04.'
apt-get update
apt-get install -y ca-certificates curl gnupg
install -d -m 0755 /etc/apt/keyrings
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl --fail --silent --show-error --proto '=https' https://download.docker.com/linux/ubuntu/gpg -o "$tmp/docker.asc"
fpr=$(gpg --batch --show-keys --with-colons "$tmp/docker.asc" | awk -F: '$1=="fpr" && !seen++ {print $10}')
[[ $fpr == 9DC858229FC7DD38854AE2D88D81803C0EBFCD88 ]] || die 'Docker repository key fingerprint mismatch.'
gpg --batch --dearmor --output "$tmp/docker.gpg" "$tmp/docker.asc"
install -m 0644 "$tmp/docker.gpg" /etc/apt/keyrings/docker.gpg
printf 'deb [arch=%s signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu %s stable\n'   "$(dpkg --print-architecture)" "$VERSION_CODENAME" >/etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker
printf 'Anyone in the docker group has root-equivalent access. Use sudo docker for deploy commands.\n'
