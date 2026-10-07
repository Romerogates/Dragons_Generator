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

disk_pct=$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')
if [ -n "$disk_pct" ] && [ "$disk_pct" -ge 85 ]; then
  echo "watchdog: disque ${disk_pct}% — prune images Docker"
  docker image prune -af --filter "until=168h" >/dev/null 2>&1 || true
  docker builder prune -af --filter "until=168h" >/dev/null 2>&1 || true
fi

api_ok=0
if docker compose -f "$COMPOSE_FILE" exec -T dragons-api curl -sf --max-time 8 http://localhost:8080/health >/dev/null 2>&1; then
  api_ok=1
fi
if [ "$api_ok" -eq 0 ]; then
  echo "watchdog: API unhealthy — restart dragons-api"
  docker compose -f "$COMPOSE_FILE" restart dragons-api >/dev/null 2>&1 || true
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
fi
