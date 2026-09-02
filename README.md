# Dragons Generator

Application web de création de personnages et de gestion de campagnes JDR (Angular 20 + .NET 9), déployée en production sur [dragons-generator.top](https://dragons-generator.top).

## Structure du dépôt

| Dossier | Rôle |
|---------|------|
| `DragonsGenerator.WEB/` | Front Angular (PWA, wizard perso, campagnes, guide) |
| `DragonsGenerator.API/` | API REST .NET 9 (FastEndpoints, SQLite, auth cookie HttpOnly) |
| `DragonsGenerator.API.Tests/` | Tests d'intégration API |
| `docs/` | Documentation fonctionnelle et ops |
| `scripts/` | Scripts deploy (Ollama, VAPID, etc.) |
| `docker-compose.*.yml` | Stack locale, test et production |

## Prérequis

- **Node.js** 24+ et npm
- **.NET SDK** 9.0
- **Docker** (stack locale complète + E2E)

## Démarrage local (Docker) — recommandé avant push

```powershell
# Windows — depuis la racine du repo
.\scripts\start-local.ps1 -Build
```

Équivalent manuel :

```bash
docker compose -f docker-compose.local.yml up --build -d
```

| Service | URL |
|---------|-----|
| **App (front + API proxy)** | http://localhost:8081 |
| API directe / Swagger | http://localhost:8080/swagger |
| MailHog (emails dev) | http://localhost:8025 |

Comptes seed (Development) : `test@dragons.local` / `TestDragons!2026`, `admin@dragons.local` / `AdminDragons!2026`

Compte perso en local : copier `.env.local.example` → `.env.local` (gitignored) et ajouter un `DevSeed__Users__1__*`.

### Front hot-reload + API Docker

```bash
# Terminal 1 — API seule (si la stack complète n'est pas déjà up)
docker compose -f docker-compose.local.yml up -d mailhog ollama dragons-api

# Terminal 2
cd DragonsGenerator.WEB
npm start
```

→ http://localhost:4200 — le proxy `/api` pointe vers **localhost:8080** (API Docker).

Pour `dotnet run` sur le port **5117** à la place :

```bash
ng serve --proxy-config proxy.conf.dotnet.json
```

Copier `.env.local.example` vers `.env.local` si besoin de overrides Groq, etc.

## Développement front seul

```bash
cd DragonsGenerator.WEB
npm ci
npm start
```

Par défaut : http://localhost:4200 (API à configurer via `environment.development.ts` ou proxy).

## Tests

```powershell
# Windows — API + unitaires (+ option E2E comme la CI)
.\scripts\run-tests.ps1
.\scripts\run-tests.ps1 -E2E -Build
```

```bash
# API
dotnet test DragonsGenerator.API.Tests/DragonsGenerator.API.Tests.csproj -c Release

# Front (unitaires)
cd DragonsGenerator.WEB
npm test

# E2E Playwright (stack Docker sur :8081)
docker compose -f docker-compose.local.yml up -d --build
cd DragonsGenerator.WEB
set E2E_BASE_URL=http://localhost:8081   # Windows
npm run e2e:ci
```

## Lint

```bash
cd DragonsGenerator.WEB
npm run lint
```

## CI / déploiement

Push sur `main` → GitHub Actions (`.github/workflows/deploy.yml`) :

1. Tests API + tests Angular  
2. E2E Playwright  
3. Deploy SSH sur le serveur de production  

Les secrets prod (`Jwt__Key`, `Admin__*`, SMTP…) restent dans `.env` sur le serveur, jamais commités.

## Authentification (Phase 2)

| Élément | Comportement |
|---------|--------------|
| **Session** | Cookie HttpOnly `dg_session` (JWT côté serveur, **non** exposé au JS) |
| **Front** | `withCredentials: true` sur `/api/*` ; profil utilisateur en `sessionStorage` |
| **Création perso** | Sans compte (wizard + brouillon local) |
| **Sauvegarde perso / campagnes** | Compte obligatoire ; file d’attente offline si déconnecté |
| **Compat API** | Header `Authorization: Bearer` toujours accepté (tests, outils) |

Après un deploy majeur auth, les utilisateurs doivent **se reconnecter** une fois.

## Données

- **Catalogue de jeu** (~1000 JSON dans `DragonsGenerator.API/Data/`) : espèces, sorts, créatures… chargés en mémoire, versionnés avec le code.
- **Données utilisateur** : SQLite (`dragons.db`) — campagnes et personnages en blobs JSON document, membres/invites normalisés.

## Documentation

- [Fonctionnalités](docs/FONCTIONNALITES.md)
- Guide intégré : `/guide` dans l’app
- [Déploiement prod (VPS / Docker / Actions)](docs/DEPLOY-PROD.md)
- [Restauration / backup](docs/restauration.md)
- [Email DNS OVH](docs/EMAIL-DNS-OVH.md)

## Conventions code (front)

- Architecture `core` / `features` / `shared`, aliases `@core/*`, `@features/*`
- TypeScript strict, composants `OnPush` par défaut
- Signals Angular (`signal`, `computed`, `input`, `output`)
- Contenu statique du guide dans `features/guide/guide-content.ts`
