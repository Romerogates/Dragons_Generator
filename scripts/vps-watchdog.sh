#!/usr/bin/env bash
# Filet local : disque, API morte, nginx. Ne tourne pas pendant un deploy.
set -u
ROOT="${DRAGONS_ROOT:-$HOME/Dragons_Generator}"
COMPOSE_FILE="${1:-$ROOT/docker-compose.prod.yml}"
LOCK="${DRAGONS_DEPLOY_LOCK:-/tmp/dragons-deploy.lock}"

if [ -f "$LOCK" ]; then
  echo "watchdog: deploy en cours — skip"
  exit 0
fi

cd "$ROOT" || exit 0

ALERT="$ROOT/scripts/send-alert-email.sh"
send_alert() {
  if [ -x "$ALERT" ]; then
    "$ALERT" "$@" || true
  fi
}

disk_pct=$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
if [ -n "$disk_pct" ] && [ "$disk_pct" -ge 85 ]; then
  echo "watchdog: disque ${disk_pct}% — prune images Docker"
  docker image prune -af --filter "until=168h" >/dev/null 2>&1 || true
  docker builder prune -af --filter "until=168h" >/dev/null 2>&1 || true
  send_alert disk "Dragons Generator — disque ${disk_pct}%" \
    "Le VPS Dragons-Generator a le disque à ${disk_pct} %. Un prune Docker a été lancé. Vérifie l’espace si ça se répète."
fi

api_ok=0
if docker compose -f "$COMPOSE_FILE" exec -T dragons-api curl -sf --max-time 8 http://localhost:8080/health >/dev/null 2>&1; then
  api_ok=1
fi
if [ "$api_ok" -eq 0 ]; then
  echo "watchdog: API unhealthy — restart dragons-api"
  docker compose -f "$COMPOSE_FILE" restart dragons-api >/dev/null 2>&1 || true
  send_alert api "Dragons Generator — API relancée" \
    "Le watchdog VPS a trouvé l’API unhealthy et a redémarré dragons-api. Site : https://dragons-generator.top"
  sleep 8
fi

web_ok=0
if curl -sf --max-time 8 http://127.0.0.1/api/health >/dev/null 2>&1 \
  || curl -skf --max-time 8 https://127.0.0.1/api/health >/dev/null 2>&1; then
  web_ok=1
fi
if [ "$web_ok" -eq 0 ]; then
  echo "watchdog: nginx/API gateway unhealthy — restart dragons-web"
  docker compose -f "$COMPOSE_FILE" restart dragons-web >/dev/null 2>&1 || true
  send_alert web "Dragons Generator — nginx relancé" \
    "Le watchdog VPS a trouvé la passerelle HTTPS unhealthy et a redémarré dragons-web. Site : https://dragons-generator.top"
fi

BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/dragons}"
latest=$(ls -1t "$BACKUP_DIR"/dragons-*.db 2>/dev/null | head -1 || true)
if [ -n "$latest" ]; then
  age=$(( $(date +%s) - $(stat -c %Y "$latest") ))
  if [ "$age" -gt $((36 * 3600)) ]; then
    send_alert backup "Dragons Generator — backup trop vieux" \
      "Le dernier backup SQLite ($latest) a plus de 36 h. Vérifie le cron 3h et /var/log/dragons-backup.log."
  fi
fi
