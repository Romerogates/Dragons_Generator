#!/usr/bin/env bash
# Enregistre un événement ops visible dans /admin. Usage : log-ops-event.sh <kind> <title> [detail]
set -euo pipefail
KIND="${1:?kind manquant}"
TITLE="${2:?title manquant}"
DETAIL="${3:-}"
ROOT="${DRAGONS_ROOT:-$HOME/Dragons_Generator}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT/docker-compose.prod.yml}"

if [ ! -f "$COMPOSE_FILE" ]; then
  echo "ops-log skip: compose introuvable"
  exit 0
fi

export OPS_KIND="$KIND"
export OPS_TITLE="$TITLE"
export OPS_DETAIL="$DETAIL"
payload=$(python3 - <<'PY'
import json, os
print(json.dumps({
    "kind": os.environ.get("OPS_KIND", "")[:64],
    "title": os.environ.get("OPS_TITLE", "")[:240],
    "detail": os.environ.get("OPS_DETAIL", "")[:4000],
}, ensure_ascii=False))
PY
)

cd "$ROOT"
docker compose -f "$COMPOSE_FILE" exec -T dragons-api \
  curl -sf -X POST http://localhost:8080/internal/ops-events \
  -H "Content-Type: application/json" \
  -d "$payload" >/dev/null || echo "WARN: ops-event non enregistré ($KIND)"
