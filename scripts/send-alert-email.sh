#!/usr/bin/env bash
# Alerte ops : journal admin seulement. Pas de mail (trop de bruit).
# Usage : send-alert-email.sh <clé> <sujet> <corps>
set -euo pipefail
KEY="${1:?clé manquante}"
SUBJECT="${2:?sujet manquant}"
BODY="${3:?corps manquant}"
ROOT="${DRAGONS_ROOT:-$HOME/Dragons_Generator}"
COOLDOWN_SEC="${ALERT_COOLDOWN_SEC:-86400}"
STAMP="/tmp/dragons-alert-${KEY}"

now=$(date +%s)
if [ -f "$STAMP" ]; then
  last=$(cat "$STAMP" 2>/dev/null || echo 0)
  if [ "$((now - last))" -lt "$COOLDOWN_SEC" ]; then
    echo "alert: cooldown ($KEY) — journal non recopié, pas de mail"
    exit 0
  fi
fi

echo "$now" >"$STAMP"
echo "alert logged ($KEY) — no mail: $SUBJECT"
if [ -x "$ROOT/scripts/log-ops-event.sh" ]; then
  "$ROOT/scripts/log-ops-event.sh" alert "$SUBJECT" "$BODY" || true
fi
exit 0
