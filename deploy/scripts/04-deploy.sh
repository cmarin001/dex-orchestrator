#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"
require_deploy
cd "$repo"
[[ -f .env && ! -L .env && $(stat -c %a .env) == 600 ]] || die 'Install a real .env file with mode 600 first.'
case "$(setting OPERATING_MODE)" in
  strategies|human|ai|hybrid) ;;
  *) die 'Set OPERATING_MODE in .env.' ;;
esac
env_has_no_secrets || die '.env contains credential values or invalid entries.'
case "$(setting EXECUTION_MODE)" in
  paper|live) ;;
  *) die 'Set EXECUTION_MODE to paper or live.' ;;
esac
audit=$(setting AUDIT_PATH)
[[ ${audit:-data/audit.jsonl} =~ ^data/[A-Za-z0-9_-]+\.jsonl$ ]] ||
  die 'AUDIT_PATH must name a journal under data/.'
if [[ $(setting EXECUTION_MODE) == live && ${audit:-data/audit.jsonl} == data/audit.jsonl ]]; then
  die 'Live must use a dedicated journal after the paper verification.'
fi
git pull --ff-only
if [[ $(setting EXECUTION_MODE) == live ]]; then
  read -r verified when < /var/lib/dex-orchestrator/verified || die "Run 99-verify.sh in paper mode first."
  [[ $verified == "$(git rev-parse HEAD)" && $when =~ ^[0-9]{10}$ ]] || die "This commit lacks a paper verification receipt."
  (( $(date +%s) - 10#$when >= 0 && $(date +%s) - 10#$when <= 86400 )) || die "The paper verification receipt expired."
fi
bash deploy/scripts/02-secrets-init.sh --check
install -d -m 0700 "$repo/data" "$repo/data/controls"
compose config --quiet
compose build
compose up -d
compose ps
# Report the tail only if the mounted credentials are absent from it.
worker=$(compose ps -q worker)
if [[ -n $worker ]]; then
  compose logs --no-color --tail=20 worker | compose exec -T worker node dist/health.js --safe-logs
fi
