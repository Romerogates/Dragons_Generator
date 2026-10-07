#!/usr/bin/env bash
# Renouvelle le cert Let’s Encrypt s’il expire dans moins de 30 jours.
# Standalone : nginx lâche le port 80 le temps du challenge HTTP-01.
set -euo pipefail

CERT="${LE_CERT_PATH:-/etc/letsencrypt/live/dragons-generator.top/cert.pem}"
COMPOSE_FILE="${1:-docker-compose.prod.yml}"
WEBROOT="${CERTBOT_WEBROOT:-/var/www/certbot}"

mkdir -p "$WEBROOT" 2>/dev/null || sudo -n mkdir -p "$WEBROOT" 2>/dev/null || true

if [ ! -f "$CERT" ]; then
  echo "WARN: certificat introuvable ($CERT) — renouvellement sauté"
  exit 0
fi

if openssl x509 -checkend 2592000 -noout -in "$CERT" 2>/dev/null; then
  echo "Certificat encore valable plus de 30 jours"
  exit 0
fi

if ! command -v certbot >/dev/null 2>&1; then
  echo "WARN: certbot absent — installer : sudo apt install -y certbot"
  exit 0
fi

echo "Certificat bientôt expiré (ou déjà) — renouvellement Let’s Encrypt"
docker compose -f "$COMPOSE_FILE" stop dragons-web || true

set +e
if sudo -n certbot renew --non-interactive --standalone --preferred-challenges http; then
  echo "certbot renew OK"
else
  echo "WARN: sudo certbot renew a échoué (sudo sans mot de passe ou certbot)."
  echo "  Sur le VPS : sudo certbot renew --standalone && docker compose -f $COMPOSE_FILE up -d dragons-web"
fi
set -e

docker compose -f "$COMPOSE_FILE" up -d dragons-web
