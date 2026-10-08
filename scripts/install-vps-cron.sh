#!/usr/bin/env bash
# Installe le cron local (watchdog 5 min + renew cert lundi 4h) sans écraser le reste.
set -euo pipefail
ROOT="${DRAGONS_ROOT:-$HOME/Dragons_Generator}"
WATCH="$ROOT/scripts/vps-watchdog.sh"
RENEW="$ROOT/scripts/renew-letsencrypt.sh"
BACKUP="$ROOT/scripts/backup-sqlite.sh"
BEGIN="# BEGIN DRAGONS-WATCHDOG"
END="# END DRAGONS-WATCHDOG"

chmod +x "$WATCH" "$RENEW" "$BACKUP" "$ROOT/scripts/send-backup-email.sh" "$ROOT/scripts/send-alert-email.sh" "$ROOT/scripts/log-ops-event.sh" 2>/dev/null || true

existing=$(crontab -l 2>/dev/null || true)
filtered=$(printf '%s\n' "$existing" | sed "/^$BEGIN\$/,/^$END\$/d" | grep -v 'backup-sqlite.sh' | grep -v 'vps-watchdog.sh' | grep -v 'renew-letsencrypt.sh' || true)

{
  printf '%s\n' "$filtered"
  echo "$BEGIN"
  echo "*/5 * * * * $WATCH $ROOT/docker-compose.prod.yml >> /tmp/dragons-watchdog.log 2>&1"
  echo "0 4 * * 1 $RENEW $ROOT/docker-compose.prod.yml >> /tmp/dragons-certbot.log 2>&1"
  echo "0 3 * * * $BACKUP >> /var/log/dragons-backup.log 2>&1"
  echo "$END"
} | crontab -

echo "Cron Dragons installé (watchdog */5, certbot lundi 04:00, backup 03:00)"
"$ROOT/scripts/log-ops-event.sh" cron "Crons VPS installés" "watchdog */5, certbot lundi 04:00, backup 03:00" || true
