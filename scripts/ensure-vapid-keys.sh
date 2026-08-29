#!/usr/bin/env bash
# Génère et enregistre les clés VAPID dans .env si absentes (push notifications prod).
set -euo pipefail

ENV_FILE="${1:-$HOME/Dragons_Generator/.env}"
touch "$ENV_FILE"

if grep -qE '^Vapid__PublicKey=.+$' "$ENV_FILE" && grep -qE '^Vapid__PrivateKey=.+$' "$ENV_FILE"; then
  echo "VAPID keys already present in ${ENV_FILE}"
  exit 0
fi

generate_keys() {
  if command -v node >/dev/null 2>&1; then
    npx --yes web-push generate-vapid-keys --json
    return
  fi
  if command -v docker >/dev/null 2>&1; then
    docker run --rm node:22-alpine sh -c 'npx --yes web-push generate-vapid-keys --json'
    return
  fi
  echo "ERROR: node or docker required to generate VAPID keys" >&2
  exit 1
}

keys="$(generate_keys)"
pub="$(printf '%s' "$keys" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).publicKey" 2>/dev/null || true)"
priv="$(printf '%s' "$keys" | node -pe "JSON.parse(require('fs').readFileSync(0,'utf8')).privateKey" 2>/dev/null || true)"

if [ -z "$pub" ] || [ -z "$priv" ]; then
  # Parse without local node (docker fallback)
  pub="$(printf '%s' "$keys" | sed -n 's/.*"publicKey"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  priv="$(printf '%s' "$keys" | sed -n 's/.*"privateKey"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
fi

if [ -z "$pub" ] || [ -z "$priv" ]; then
  echo "ERROR: failed to parse VAPID keys" >&2
  exit 1
fi

grep -qE '^Vapid__PublicKey=' "$ENV_FILE" || echo "Vapid__PublicKey=$pub" >> "$ENV_FILE"
grep -qE '^Vapid__PrivateKey=' "$ENV_FILE" || echo "Vapid__PrivateKey=$priv" >> "$ENV_FILE"
grep -qE '^Vapid__Subject=' "$ENV_FILE" || echo "Vapid__Subject=mailto:noreply@dragons-generator.top" >> "$ENV_FILE"

echo "VAPID keys written to ${ENV_FILE}"
