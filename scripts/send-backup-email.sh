#!/usr/bin/env bash
# Envoie le backup SQLite (zip) à Alert__Email. Usage : send-backup-email.sh <fichier.db> [uploads.tar.gz]
set -euo pipefail
DB_FILE="${1:?fichier db manquant}"
UPLOADS_FILE="${2:-}"
ROOT="${DRAGONS_ROOT:-$HOME/Dragons_Generator}"
ENV_FILE="${ALERT_ENV_FILE:-$ROOT/.env}"
TO_DEFAULT="Anthony.martinr@hotmail.be"
MAX_BYTES="${BACKUP_EMAIL_MAX_BYTES:-18000000}"

if [ ! -s "$DB_FILE" ]; then
  echo "WARN: backup db absent — mail non envoyé"
  exit 0
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "WARN: python3 absent — impossible d’envoyer le backup"
  exit 0
fi

export ALERT_ENV_FILE="$ENV_FILE"
export ALERT_TO_DEFAULT="$TO_DEFAULT"
export BACKUP_DB_FILE="$DB_FILE"
export BACKUP_UPLOADS_FILE="$UPLOADS_FILE"
export BACKUP_EMAIL_MAX_BYTES="$MAX_BYTES"

python3 - <<'PY'
import os, smtplib, ssl, zipfile, tempfile
from email.message import EmailMessage
from pathlib import Path

def load_env(path: str) -> dict[str, str]:
    data: dict[str, str] = {}
    p = Path(path)
    if not p.is_file():
        return data
    for raw in p.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        data[k.strip()] = v.strip().strip('"').strip("'")
    return data

env = load_env(os.environ.get("ALERT_ENV_FILE", ""))
host = env.get("Smtp__Host", "")
if host.lower() in {"", "log", "mailhog", "localhost", "127.0.0.1"}:
    raise SystemExit("smtp skip: sink local")

to_addr = env.get("Alert__Email") or os.environ.get("ALERT_TO_DEFAULT", "")
from_addr = env.get("Smtp__FromEmail") or env.get("Smtp__UserName") or "dragons@romerogates.be"
from_name = env.get("Smtp__FromName") or "Dragons Generator"
port = int(env.get("Smtp__Port") or "465")
user = env.get("Smtp__UserName") or ""
password = env.get("Smtp__Password") or ""
use_ssl = (env.get("Smtp__UseSsl") or "true").lower() in {"1", "true", "yes"}
max_bytes = int(os.environ.get("BACKUP_EMAIL_MAX_BYTES") or "18000000")

db = Path(os.environ["BACKUP_DB_FILE"])
uploads = Path(os.environ.get("BACKUP_UPLOADS_FILE") or "")
stamp = db.stem.replace("dragons-", "")
zip_path = Path(tempfile.gettempdir()) / f"dragons-backup-{stamp}.zip"

with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
    zf.write(db, arcname=db.name)
    if uploads.is_file() and uploads.stat().st_size > 0:
        zf.write(uploads, arcname=uploads.name)

size = zip_path.stat().st_size
note = (
    f"Backup Dragons Generator ({stamp}).\n"
    f"Fichier joint : {zip_path.name} ({size} octets).\n"
    f"Garde-le hors du VPS (PC, disque, cloud perso).\n"
    f"Restauration : docs/restauration.md sur le dépôt.\n"
)
attach = size <= max_bytes
if not attach:
    note += (
        f"\nPièce trop lourde pour Hotmail/OVH (limite {max_bytes} octets). "
        f"Le fichier reste sur le VPS : ~/backups/dragons/\n"
    )

msg = EmailMessage()
msg["From"] = f"{from_name} <{from_addr}>"
msg["To"] = to_addr
msg["Subject"] = f"Backup Dragons Generator — {stamp}"
msg.set_content(note)
if attach:
    msg.add_attachment(
        zip_path.read_bytes(),
        maintype="application",
        subtype="zip",
        filename=zip_path.name,
    )

ctx = ssl.create_default_context()
if port == 465 or use_ssl:
    with smtplib.SMTP_SSL(host, port, timeout=60, context=ctx) as smtp:
        if user:
            smtp.login(user, password)
        smtp.send_message(msg)
else:
    with smtplib.SMTP(host, port, timeout=60) as smtp:
        smtp.ehlo()
        smtp.starttls(context=ctx)
        if user:
            smtp.login(user, password)
        smtp.send_message(msg)

zip_path.unlink(missing_ok=True)
print(f"backup mailed to {to_addr} attach={attach} bytes={size}")
PY
ROOT="${DRAGONS_ROOT:-$HOME/Dragons_Generator}"
if [ -x "$ROOT/scripts/log-ops-event.sh" ]; then
  "$ROOT/scripts/log-ops-event.sh" backup_mail "Backup mailé" "$(basename "$DB_FILE")" || true
fi
