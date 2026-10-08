#!/usr/bin/env bash
# Mail de confirmation backup — SANS zip (Hotmail le vide). Les fichiers restent sur le VPS.
# Usage : send-backup-email.sh <fichier.db> [uploads.tar.gz]
set -euo pipefail
DB_FILE="${1:?fichier db manquant}"
UPLOADS_FILE="${2:-}"
ROOT="${DRAGONS_ROOT:-$HOME/Dragons_Generator}"
ENV_FILE="${ALERT_ENV_FILE:-$ROOT/.env}"
TO_DEFAULT="Anthony.martinr@hotmail.be"
PUBLIC_URL="${APP_PUBLIC_WEB_URL:-https://dragons-generator.top}"

if [ ! -s "$DB_FILE" ]; then
  echo "WARN: backup db absent — mail non envoyé"
  exit 0
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "WARN: python3 absent — impossible d’envoyer le mail backup"
  exit 0
fi

export ALERT_ENV_FILE="$ENV_FILE"
export ALERT_TO_DEFAULT="$TO_DEFAULT"
export BACKUP_DB_FILE="$DB_FILE"
export BACKUP_UPLOADS_FILE="$UPLOADS_FILE"
export BACKUP_PUBLIC_URL="$PUBLIC_URL"

python3 - <<'PY'
import os, smtplib, ssl
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
web = (os.environ.get("BACKUP_PUBLIC_URL") or env.get("App__PublicWebUrl") or "https://dragons-generator.top").rstrip("/")

db = Path(os.environ["BACKUP_DB_FILE"])
uploads = Path(os.environ.get("BACKUP_UPLOADS_FILE") or "")
stamp = db.stem.replace("dragons-", "")
db_size = db.stat().st_size
up_size = uploads.stat().st_size if uploads.is_file() else 0
desk = f"{web}/admin?tab=ops"

text = (
    f"Backup Dragons Generator OK — {stamp}\n\n"
    f"Base : {db.name} ({db_size} octets)\n"
    f"Uploads : {uploads.name if uploads.is_file() else '—'} ({up_size} octets)\n"
    f"Stockage VPS : ~/backups/dragons/ (14 jours)\n\n"
    f"Télécharger (connecté admin) : {desk}\n"
    f"Aucun zip en pièce jointe : Hotmail le vidait. Le fichier reste sur le serveur, gratuit.\n"
)
html = f"""<html><body style="font-family:sans-serif;background:#111827;color:#e5e7eb;padding:24px">
<h1 style="color:#f59e0b;font-size:20px">Backup OK — {stamp}</h1>
<p>Le snapshot est <strong>sur le VPS</strong> (pas en pièce jointe, Hotmail le coupait).</p>
<ul>
<li>Base : <code>{db.name}</code> — {db_size} octets</li>
<li>Uploads : <code>{uploads.name if uploads.is_file() else '—'}</code> — {up_size} octets</li>
<li>Dossier : <code>~/backups/dragons/</code> (rétention 14 jours)</li>
</ul>
<p><a href="{desk}" style="color:#f59e0b">Télécharger depuis le desk admin → onglet Backups</a></p>
</body></html>"""

msg = EmailMessage()
msg["From"] = f"{from_name} <{from_addr}>"
msg["To"] = to_addr
msg["Subject"] = f"Backup Dragons Generator — {stamp} (sur le VPS)"
msg.set_content(text)
msg.add_alternative(html, subtype="html")

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

print(f"backup mailed to {to_addr} attach=false bytes={db_size}")
PY

if [ -x "$ROOT/scripts/log-ops-event.sh" ]; then
  "$ROOT/scripts/log-ops-event.sh" backup_mail "Backup stocké sur le VPS" "$(basename "$DB_FILE")" || true
fi
