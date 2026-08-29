#!/usr/bin/env bash
# Backup SQLite + uploads tickets (prod Docker volume).
# Usage: ./scripts/backup-sqlite.sh
# Cron example: 0 3 * * * /home/debian/Dragons_Generator/scripts/backup-sqlite.sh >> /var/log/dragons-backup.log 2>&1
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE_DIR="${COMPOSE_DIR:-$HOME/Dragons_Generator}"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/dragons}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
SQLITE_IMAGE="${SQLITE_IMAGE:-keinos/sqlite3:latest}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
VOLUME_NAME="${VOLUME_NAME:-}"

log() {
  echo "[$(date -Iseconds)] $*"
}

resolve_volume_name() {
  if [ -n "$VOLUME_NAME" ]; then
    echo "$VOLUME_NAME"
    return
  fi

  cd "$COMPOSE_DIR"
  local project
  project="$(docker compose -f "$COMPOSE_FILE" ls -q 2>/dev/null | head -1 || true)"
  if [ -n "$project" ]; then
    echo "${project}_dragons-api-data"
    return
  fi

  docker volume ls --format '{{.Name}}' | grep 'dragons-api-data$' | head -1
}

main() {
  mkdir -p "$BACKUP_DIR"

  local volume
  volume="$(resolve_volume_name)"
  if [ -z "$volume" ]; then
    log "ERROR: Docker volume dragons-api-data introuvable"
    exit 1
  fi

  if ! docker volume inspect "$volume" >/dev/null 2>&1; then
    log "ERROR: Volume Docker inexistant: $volume"
    exit 1
  fi

  local db_backup="$BACKUP_DIR/dragons-${TIMESTAMP}.db"
  local uploads_backup="$BACKUP_DIR/uploads-${TIMESTAMP}.tar.gz"

  log "Volume: $volume"
  log "Backup DB -> $db_backup"

  docker run --rm --user 0:0 \
    -v "${volume}:/data:ro" \
    -v "${BACKUP_DIR}:/backups" \
    "$SQLITE_IMAGE" \
    sqlite3 "/data/dragons.db" ".backup '/backups/$(basename "$db_backup")'"

  if [ ! -s "$db_backup" ]; then
    log "ERROR: Backup DB vide ou absent"
    exit 1
  fi

  log "Backup uploads -> $uploads_backup"
  if docker run --rm --user 0:0 \
    -v "${volume}:/data:ro" \
    -v "${BACKUP_DIR}:/backups" \
    alpine:3.20 \
    sh -c "[ -d /data/uploads ] && tar czf /backups/$(basename "$uploads_backup") -C /data uploads || tar czf /backups/$(basename "$uploads_backup") --files-from /dev/null"; then
    :
  else
    log "ERROR: Échec archive uploads"
    exit 1
  fi

  log "Purge backups > ${RETENTION_DAYS} jours dans $BACKUP_DIR"
  find "$BACKUP_DIR" -type f \( -name 'dragons-*.db' -o -name 'uploads-*.tar.gz' \) -mtime +"$RETENTION_DAYS" -delete

  local db_count uploads_count
  db_count="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'dragons-*.db' | wc -l | tr -d ' ')"
  uploads_count="$(find "$BACKUP_DIR" -maxdepth 1 -type f -name 'uploads-*.tar.gz' | wc -l | tr -d ' ')"
  log "OK — ${db_count} backup(s) DB, ${uploads_count} archive(s) uploads conservés"
}

main "$@"
