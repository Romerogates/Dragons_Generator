# Restauration Dragons Generator (production)

Guide de secours si la base SQLite, le volume Docker ou le serveur est endommagé.

**Serveur :** VPS Debian (`~/Dragons_Generator`)  
**Site :** https://dragons-generator.top  
**Backups automatiques :** tous les jours à **3h** → `~/backups/dragons/`

---

## 1. Vérifier que des backups existent

Connecte-toi en SSH au VPS :

```bash
ssh debian@37.59.110.227
ls -lh ~/backups/dragons/
```

Tu dois voir des paires du type :

- `dragons-YYYYMMDD-HHMMSS.db` — snapshot SQLite cohérent
- `uploads-YYYYMMDD-HHMMSS.tar.gz` — pièces jointes des tickets support

**Rétention :** 14 jours (les plus anciens sont supprimés automatiquement).

### Lancer un backup manuel (optionnel)

```bash
cd ~/Dragons_Generator
./scripts/backup-sqlite.sh
```

Logs cron : `/var/log/dragons-backup.log`

---

## 2. Avant de restaurer

1. Choisis la **date de backup** la plus récente **avant** l'incident.
2. Note les noms de fichiers, par exemple :
   - `dragons-20260829-095410.db`
   - `uploads-20260829-095410.tar.gz`
3. Prévois **2 à 5 minutes** de coupure (API arrêtée le temps de la restauration).

---

## 3. Restauration complète (DB + uploads)

```bash
cd ~/Dragons_Generator

# Variables — adapte la date/heure du backup choisi
BACKUP_DATE=20260829-095410
BACKUP_DIR="$HOME/backups/dragons"
VOLUME="dragons_generator_dragons-api-data"

# 1. Arrêter l'API (le front nginx peut rester up)
docker compose -f docker-compose.prod.yml stop dragons-api

# 2. Restaurer la base SQLite dans le volume Docker
docker run --rm --user 0:0 \
  -v "${VOLUME}:/data" \
  -v "${BACKUP_DIR}:/backups:ro" \
  keinos/sqlite3:latest \
  sh -c "cp /backups/dragons-${BACKUP_DATE}.db /data/dragons.db && rm -f /data/dragons.db-wal /data/dragons.db-shm"

# 3. Restaurer les pièces jointes tickets
docker run --rm --user 0:0 \
  -v "${VOLUME}:/data" \
  -v "${BACKUP_DIR}:/backups:ro" \
  alpine:3.20 \
  sh -c "rm -rf /data/uploads && tar xzf /backups/uploads-${BACKUP_DATE}.tar.gz -C /data"

# 4. Redémarrer l'API
docker compose -f docker-compose.prod.yml up -d dragons-api

# 5. Vérifier
docker compose -f docker-compose.prod.yml ps
curl -sf https://dragons-generator.top/api/species/summary | head -c 120
echo
```

Si `curl` renvoie du JSON (liste d'espèces), l'API est de nouveau OK.

---

## 4. Restauration base seule (sans uploads)

Si tu n'as que le `.db` ou si les uploads ne sont pas concernés :

```bash
cd ~/Dragons_Generator
BACKUP_DATE=20260829-095410
BACKUP_DIR="$HOME/backups/dragons"
VOLUME="dragons_generator_dragons-api-data"

docker compose -f docker-compose.prod.yml stop dragons-api

docker run --rm --user 0:0 \
  -v "${VOLUME}:/data" \
  -v "${BACKUP_DIR}:/backups:ro" \
  keinos/sqlite3:latest \
  sh -c "cp /backups/dragons-${BACKUP_DATE}.db /data/dragons.db && rm -f /data/dragons.db-wal /data/dragons.db-shm"

docker compose -f docker-compose.prod.yml up -d dragons-api
```

---

## 5. Vérifications après restauration

| Check | Commande / action |
|-------|-------------------|
| Conteneurs | `docker compose -f docker-compose.prod.yml ps` |
| Logs API | `docker logs dragons-api --tail 50` |
| Login admin | https://dragons-generator.top → compte admin |
| Comptes utilisateurs | Admin → onglet Utilisateurs |
| Campagnes / persos | Se connecter avec un compte test |

**Important :** les données créées **après** le backup choisi seront perdues.

---

## 6. Si le volume Docker a été supprimé

```bash
cd ~/Dragons_Generator
docker compose -f docker-compose.prod.yml up -d   # recrée le volume vide
# Puis enchaîne avec la section 3 (restauration complète)
```

Le fichier `.env` (JWT, admin, SMTP, Groq) est **à part** du volume : il reste dans `~/Dragons_Generator/.env`.

---

## 7. En cas de problème

| Symptôme | Piste |
|----------|--------|
| API ne démarre pas | `docker logs dragons-api` — souvent secret JWT/admin manquant dans `.env` |
| `database is locked` | API pas arrêtée avant restore → refaire en `stop`ant `dragons-api` |
| Volume introuvable | `docker volume ls \| grep dragons-api-data` |
| Backup absent | `./scripts/backup-sqlite.sh` manuel immédiat pour ne pas rester sans filet |

---

## 8. Fichiers utiles sur le VPS

| Chemin | Rôle |
|--------|------|
| `~/Dragons_Generator/` | Code + docker-compose prod |
| `~/Dragons_Generator/.env` | Secrets (JWT, admin, SMTP, Groq…) |
| `~/backups/dragons/` | Backups quotidiens |
| `/var/log/dragons-backup.log` | Log du cron backup |
| Volume `dragons_generator_dragons-api-data` | `dragons.db` + `uploads/` en runtime |

---

## 9. Copier un backup en local (optionnel)

Depuis **ton PC** :

```powershell
scp debian@37.59.110.227:~/backups/dragons/dragons-YYYYMMDD-HHMMSS.db .
scp debian@37.59.110.227:~/backups/dragons/uploads-YYYYMMDD-HHMMSS.tar.gz .
```

Conserve ces fichiers en lieu sûr (cloud perso, disque externe).
