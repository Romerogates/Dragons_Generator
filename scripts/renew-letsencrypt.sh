#!/usr/bin/env bash
# Renouvelle le cert Let’s Encrypt s’il expire dans moins de 30 jours.
# Standalone : nginx lâche le port 80 le temps du challenge HTTP-01.
set -euo pipefail

CERT="${LE_CERT_PATH:-/etc/letsencrypt/live/dragons-generator.top/cert.pem}"
COMPOSE_FILE="${1:-docker-compose.prod.yml}"
WEBROOT="${CERTBOT_WEBROOT:-/var/www/certbot}"

sudo_ok=0
if sudo -n true 2>/dev/null; then
  sudo_ok=1
fi

if [ "$sudo_ok" -eq 1 ]; then
  sudo -n mkdir -p "$WEBROOT"
else
  mkdir -p "$WEBROOT" 2>/dev/null || true
fi

cert_readable=0
if [ -r "$CERT" ]; then
  cert_readable=1
elif [ "$sudo_ok" -eq 1 ] && sudo -n test -f "$CERT"; then
  cert_readable=1
fi

if [ "$cert_readable" -eq 0 ]; then
  echo "WARN: certificat illisible ($CERT). Sur le VPS :"
  echo "  docker compose -f $COMPOSE_FILE stop dragons-web"
  echo "  sudo certbot renew --standalone --non-interactive"
  echo "  docker compose -f $COMPOSE_FILE up -d dragons-web"
  exit 0
fi

still_valid=0
if [ -r "$CERT" ]; then
  openssl x509 -checkend 2592000 -noout -in "$CERT" 2>/dev/null && still_valid=1
elif [ "$sudo_ok" -eq 1 ]; then
  sudo -n openssl x509 -checkend 2592000 -noout -in "$CERT" 2>/dev/null && still_valid=1
fi

if [ "$still_valid" -eq 1 ]; then
  echo "Certificat encore valable plus de 30 jours"
  exit 0
fi

if ! command -v certbot >/dev/null 2>&1 && ! sudo -n command -v certbot >/dev/null 2>&1; then
  echo "WARN: certbot absent — installer : sudo apt install -y certbot"
  exit 0
fi

if [ "$sudo_ok" -ne 1 ]; then
  echo "WARN: sudo sans mot de passe indisponible — renouveler à la main (certbot a besoin de root)."
  exit 0
fi

echo "Certificat bientôt expiré (ou déjà) — renouvellement Let’s Encrypt"
docker compose -f "$COMPOSE_FILE" stop dragons-web || true

set +e
sudo -n certbot renew --non-interactive --standalone --preferred-challenges http
renew_rc=$?
set -e

docker compose -f "$COMPOSE_FILE" up -d dragons-web

if [ "$renew_rc" -ne 0 ]; then
  echo "WARN: certbot renew a échoué (code $renew_rc)"
  exit 0
fi

echo "certbot renew OK"
