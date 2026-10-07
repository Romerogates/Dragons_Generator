#!/usr/bin/env bash
# Envoie une alerte prod (cooldown 1 h par clé). Usage : send-alert-email.sh <clé> <sujet> <corps>
set -euo pipefail
KEY="${1:?clé manquante}"
SUBJECT="${2:?sujet manquant}"
BODY="${3:?corps manquant}"
ROOT="${DRAGONS_ROOT:-$HOME/Dragons_Generator}"
ENV_FILE="${ALERT_ENV_FILE:-$ROOT/.env}"
COOLDOWN_SEC="${ALERT_COOLDOWN_SEC:-3600}"
STAMP="/tmp/dragons-alert-${KEY}"
TO_DEFAULT="Anthony.martinr@hotmail.be"

now=$(date +%s)
if [ -f "$STAMP" ]; then
  last=$(cat "$STAMP" 2>/dev/null || echo 0)
  if [ "$((now - last))" -lt "$COOLDOWN_SEC" ]; then
    echo "alert: cooldown ($KEY) — mail non renvoyé"
    exit 0
  fi
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "WARN: python3 absent — impossible d’envoyer l’alerte"
  exit 0
fi

export ALERT_ENV_FILE="$ENV_FILE"
export ALERT_TO_DEFAULT="$TO_DEFAULT"
export ALERT_SUBJECT="$SUBJECT"
export ALERT_BODY="$BODY"

if python3 - <<'PY'
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

msg = EmailMessage()
msg["From"] = f"{from_name} <{from_addr}>"
msg["To"] = to_addr
msg["Subject"] = os.environ.get("ALERT_SUBJECT", "Alerte Dragons Generator")
msg.set_content(os.environ.get("ALERT_BODY", ""))

ctx = ssl.create_default_context()
if port == 465 or use_ssl:
    with smtplib.SMTP_SSL(host, port, timeout=25, context=ctx) as smtp:
        if user:
            smtp.login(user, password)
        smtp.send_message(msg)
else:
    with smtplib.SMTP(host, port, timeout=25) as smtp:
        smtp.ehlo()
        smtp.starttls(context=ctx)
        if user:
            smtp.login(user, password)
        smtp.send_message(msg)
print(f"alert mailed to {to_addr}")
PY
then
  echo "$now" > "$STAMP"
fi
