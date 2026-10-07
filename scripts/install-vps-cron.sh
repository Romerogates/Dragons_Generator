#!/usr/bin/env bash
# Installe le cron local (watchdog 5 min + renew cert lundi 4h) sans écraser le reste.
set -euo pipefail
ROOT="${DRAGONS_ROOT:-$HOME/Dragons_Generator}"
WATCH="$ROOT/scripts/vps-watchdog.sh"
RENEW="$ROOT/scripts/renew-letsencrypt.sh"
BEGIN="# BEGIN DRAGONS-WATCHDOG"
END="# END DRAGONS-WATCHDOG"

chmod +x "$WATCH" "$RENEW" 2>/dev/null || true

existing=$(crontab -l 2>/dev/null || true)
filtered=$(printf '%s\n' "$existing" | sed "/^$BEGIN\$/,/^$END\$/d")

{
  printf '%s\n' "$filtered"
  echo "$BEGIN"
  echo "*/5 * * * * $WATCH $ROOT/docker-compose.prod.yml >> /tmp/dragons-watchdog.log 2>&1"
  echo "0 4 * * 1 $RENEW $ROOT/docker-compose.prod.yml >> /tmp/dragons-certbot.log 2>&1"
  echo "$END"
} | crontab -

echo "Cron Dragons installé (watchdog */5, certbot lundi 04:00)"
