#!/usr/bin/env bash
# Les snapshots restent sur le VPS. Plus de mail de confirmation.
# Usage : send-backup-email.sh <fichier.db> [uploads.tar.gz]
set -euo pipefail
DB_FILE="${1:?fichier db manquant}"
ROOT="${DRAGONS_ROOT:-$HOME/Dragons_Generator}"
echo "backup mail disabled — snapshot on VPS only ($(basename "$DB_FILE"))"
if [ -x "$ROOT/scripts/log-ops-event.sh" ]; then
  "$ROOT/scripts/log-ops-event.sh" backup_mail "Backup stocké sur le VPS (pas de mail)" "$(basename "$DB_FILE")" || true
fi
exit 0
