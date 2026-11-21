#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
require_root
read -rp 'Domain: ' domain
read -rp 'ACME contact email: ' email
valid_domain "$domain" || die 'Provide a valid DNS hostname.'
[[ $email =~ ^[A-Za-z0-9._+%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || die 'Provide a valid email address.'

apt-get update
apt-get install -y nginx certbot python3-certbot-nginx
site=/etc/nginx/sites-available/dex-orchestrator
enabled=/etc/nginx/sites-enabled/dex-orchestrator
[[ ! -e $enabled || -L $enabled ]] || die 'The enabled site must be a symlink.'
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
cert="/etc/letsencrypt/live/$domain"
install_site() {
  local candidate=$1
  local had_site=false had_link=false old_link=''
  if [[ -f $site ]]; then cp -p "$site" "$work/previous"; had_site=true; fi
  if [[ -L $enabled ]]; then old_link=$(readlink "$enabled"); had_link=true; fi
  install -m 0644 "$candidate" "$site"
  ln -sfn "$site" "$enabled"
  if ! nginx -t; then
    if $had_site; then install -m 0644 "$work/previous" "$site"; else rm -f "$site"; fi
    if $had_link; then ln -sfn "$old_link" "$enabled"; else rm -f "$enabled"; fi
    die 'Nginx validation failed. The previous configuration was restored.'
  fi
  systemctl reload nginx
}
systemctl enable --now nginx
if [[ ! -s $cert/fullchain.pem || ! -s $cert/privkey.pem ]]; then
  printf 'server { listen 80; listen [::]:80; server_name %s; location / { return 404; } }\n' "$domain" >"$work/http"
  install_site "$work/http"
fi
certbot certonly --nginx --cert-name "$domain" -d "$domain" --non-interactive --agree-tos --email "$email" --keep-until-expiring
sed "s/__DEX_DOMAIN__/$domain/g" "$(dirname "${BASH_SOURCE[0]}")/../nginx/dex-orchestrator.conf" >"$work/tls"
install_site "$work/tls"
systemctl enable --now certbot.timer
