#!/usr/bin/env sh
set -eu

COMPOSE_FILE="${1:-docker-compose.prod.yml}"
MODEL="${OLLAMA_MODEL:-qwen2.5:3b}"
SERVICE="${OLLAMA_SERVICE:-ollama}"

echo "==> Attente du service Ollama ($SERVICE)…"
for i in $(seq 1 60); do
  if docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" ollama list >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Téléchargement du modèle $MODEL (si absent)…"
docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" ollama pull "$MODEL"

echo "==> Modèles disponibles :"
docker compose -f "$COMPOSE_FILE" exec -T "$SERVICE" ollama list
