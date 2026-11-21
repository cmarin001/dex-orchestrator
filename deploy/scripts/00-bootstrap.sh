#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
require_root

if id deploy >/dev/null 2>&1; then
  [[ $(getent passwd deploy | cut -d: -f6) == /home/deploy ]] || die 'The existing deploy account has a different home.'
else
  useradd --create-home --home-dir /home/deploy --shell /bin/bash deploy
fi
usermod --append --groups sudo deploy
install -d -o deploy -g deploy -m 0700 /home/deploy/.ssh
if [[ ! -s /home/deploy/.ssh/authorized_keys ]]; then
  [[ -s /root/.ssh/authorized_keys ]] || die 'Install your public key for root or deploy before hardening SSH.'
  install -o deploy -g deploy -m 0600 /root/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
fi
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 0600 /home/deploy/.ssh/authorized_keys
if [[ $(passwd -S deploy | awk '{print $2}') != P ]]; then
  printf 'Set a local sudo password for deploy. SSH passwords will be disabled.\n'
  passwd deploy
fi
install -d -o deploy -g deploy -m 0750 "$repo"

apt-get update
apt-get install -y ufw fail2ban python3-systemd unattended-upgrades curl jq openssl
install -m 0644 "$(dirname "${BASH_SOURCE[0]}")/../fail2ban/jail.local" /etc/fail2ban/jail.local
cat >/etc/apt/apt.conf.d/52dex-security-only <<'APT'
#clear Unattended-Upgrade::Allowed-Origins;
#clear Unattended-Upgrade::Origins-Pattern;
Unattended-Upgrade::Origins-Pattern {
  "origin=Ubuntu,archive=${distro_codename}-security";
  "origin=UbuntuESMApps,archive=${distro_codename}-apps-security";
  "origin=UbuntuESM,archive=${distro_codename}-infra-security";
};
APT
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'APT'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT
ufw default deny incoming
ufw default allow outgoing
for port in 22 80 443; do ufw allow "$port/tcp"; done
ufw --force enable
systemctl enable --now fail2ban unattended-upgrades

if [[ ${1:-} != --harden-ssh ]]; then
  printf 'Open a new terminal and verify key login as deploy and sudo. Then rerun with --harden-ssh from that session.\n'
  exit 0
fi
[[ ${SUDO_USER:-} == deploy ]] || die 'Complete SSH hardening from the verified deploy session using sudo.'
cat >/etc/ssh/sshd_config.d/99-hardening.conf <<'SSH'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
SSH
# OpenSSH uses the first occurrence. Ensure the policy wins over cloud-init defaults.
ln -sfn 99-hardening.conf /etc/ssh/sshd_config.d/00-dex-hardening.conf
sshd -t
effective=$(sshd -T)
for setting in 'permitrootlogin no' 'passwordauthentication no' 'pubkeyauthentication yes' 'maxauthtries 3'; do
  grep -Fxq "$setting" <<< "$effective" || die "SSH policy is shadowed: $setting"
done
systemctl reload ssh
printf 'Test SSH as deploy in a NEW terminal before closing this session. If you cannot log in, you are locked out of root.\n'
