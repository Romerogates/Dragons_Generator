# Dragons Generator

Application web de création de personnages et de gestion de campagnes JDR (Angular 20 + .NET 9), déployée en production sur [dragons-generator.top](https://dragons-generator.top).

## Structure du dépôt

| Dossier | Rôle |
|---------|------|
| `DragonsGenerator.WEB/` | Front Angular (PWA, wizard perso, campagnes, guide) |
| `DragonsGenerator.API/` | API REST .NET 9 (FastEndpoints, SQLite, auth JWT) |
| `DragonsGenerator.API.Tests/` | Tests d'intégration API |
| `docs/` | Documentation fonctionnelle et ops |
| `scripts/` | Scripts deploy (Ollama, VAPID, etc.) |
| `docker-compose.*.yml` | Stack locale, test et production |

## Prérequis

- **Node.js** 24+ et npm
- **.NET SDK** 9.0
- **Docker** (stack locale complète + E2E)

## Démarrage local (Docker)

```bash
# Depuis la racine du repo
docker compose -f docker-compose.local.yml up --build
```

- Front : http://localhost:8081  
- API health : http://localhost:8081/api/health  
- MailHog (emails dev) : http://localhost:8025  

Copier `.env.local.example` vers `.env.local` si besoin de overrides.

## Développement front seul

```bash
cd DragonsGenerator.WEB
npm ci
npm start
```

Par défaut : http://localhost:4200 (API à configurer via `environment.development.ts` ou proxy).

## Tests

```bash
# API
dotnet test DragonsGenerator.API.Tests/DragonsGenerator.API.Tests.csproj -c Release

# Front (unitaires)
cd DragonsGenerator.WEB
npm test

# E2E Playwright (stack Docker requise)
npm run e2e
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
