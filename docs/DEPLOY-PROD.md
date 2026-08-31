# Déploiement production — Dragons Generator

Site : [https://dragons-generator.top](https://dragons-generator.top)  
VPS actuel : `37.59.110.227` (enregistrement DNS **A** de `dragons-generator.top`)  
Dossier app sur le serveur : `~/Dragons_Generator` (user SSH `debian`)

Les secrets (`Jwt__Key`, SMTP, `Admin__*`) restent dans le `.env` **sur le serveur**, jamais dans Git.

---

## 1. Prérequis VPS (une seule fois)

```bash
ssh debian@37.59.110.227
# ou : ssh debian@dragons-generator.top
```

Installer Docker + plugin Compose si besoin :

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker "$USER"
# se reconnecter pour que le groupe docker soit actif
```

Ports **80** et **443** ouverts (firewall / security group).  
Certificats Let’s Encrypt déjà présents sous `/etc/letsencrypt` (montés en lecture seule par [docker-compose.prod.yml](../docker-compose.prod.yml)).

---

## 2. Clone du dépôt

```bash
cd ~
git clone https://github.com/Romerogates/Dragons_Generator.git
cd Dragons_Generator
```

Si le clone existe déjà :

```bash
cd ~/Dragons_Generator
git fetch origin main
git reset --hard origin/main
```

---

## 3. Fichier `.env` (serveur uniquement)

```bash
cd ~/Dragons_Generator
cp .env.example .env
nano .env   # ou vim
```

Renseigner au minimum (voir aussi [.env.example](../.env.example)) :

| Variable | Rôle |
|----------|------|
| `Smtp__*` | OVH `dragons@romerogates.be` |
| `Jwt__Key` | ≥ 32 caractères aléatoires, unique |
| `Admin__Email` / `Admin__Password` | premier compte admin (seed au boot) |
| `App__PublicWebUrl` | `https://dragons-generator.top` |
| `Groq__ApiKey` | optionnel (backstories IA) |

Ne jamais committer `.env`.  
Le workflow CI refuse les mots de passe d’exemple et un `Jwt__Key` trop court / placeholder.

Optionnel une fois : `Admin__ResetPassword=true` puis redémarrer l’API pour forcer le MDP admin, puis **retirer** la ligne.

Clés VAPID (push PWA) : générées automatiquement par `scripts/ensure-vapid-keys.sh` au deploy.

---

## 4. Premier lancement Docker

```bash
cd ~/Dragons_Generator
chmod +x scripts/ensure-vapid-keys.sh scripts/ensure-ollama-model.sh
./scripts/ensure-vapid-keys.sh "$HOME/Dragons_Generator/.env"

docker compose -f docker-compose.prod.yml up --build -d ollama || true
./scripts/ensure-ollama-model.sh docker-compose.prod.yml || true
docker compose -f docker-compose.prod.yml up --build -d dragons-api dragons-web

docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f dragons-api
```

**Base de données :** rien à créer à la main. L’API appelle `EnsureCreatedAsync()` → SQLite dans le volume `dragons-api-data` (`/app/data/dragons.db`). Le compte admin est seedé si `Admin__*` est défini.

Mise à jour manuelle ensuite :

```bash
cd ~/Dragons_Generator
git fetch origin main && git reset --hard origin/main
docker compose -f docker-compose.prod.yml up --build -d dragons-api dragons-web
```

---

## 5. Vérifications smoke

```bash
curl -sf https://dragons-generator.top/api/health
# → {"status":"ok"}

curl -sI https://dragons-generator.top/ | head -5
# → HTTP/2 200
```

Dans le navigateur :

1. Ouvrir https://dragons-generator.top → page d’accueil
2. `/login` → se connecter avec le compte admin seedé
3. Reset MDP → mail reçu ; en-têtes Gmail : `spf=pass` / idéalement `dkim=pass`  
   DNS e-mail : [EMAIL-DNS-OVH.md](EMAIL-DNS-OVH.md)

---

## 6. Déploiement auto (GitHub Actions)

Workflow : [.github/workflows/deploy.yml](../.github/workflows/deploy.yml)

Sur push `main` (ou `workflow_dispatch`) :

1. Tests API + Angular + lint  
2. E2E Playwright  
3. SSH → `git reset --hard origin/main` + `docker compose … up --build -d` + health check

Secrets GitHub (Settings → Secrets and variables → Actions) :

| Secret | Contenu |
|--------|---------|
| `DEPLOY_HOST` | `37.59.110.227` (ou le domaine) |
| `DEPLOY_USER` | `debian` |
| `DEPLOY_SSH_KEY` | clé privée SSH autorisée sur le VPS |

La clé publique correspondante doit être dans `~/.ssh/authorized_keys` du user `debian`.

---

## Dépannage rapide

```bash
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs dragons-api --tail 80
docker compose -f docker-compose.prod.yml logs dragons-web --tail 40
ls -la /etc/letsencrypt/live/
```

Backup SQLite : voir [restauration.md](restauration.md).
