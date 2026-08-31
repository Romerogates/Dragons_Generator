# Dragons Generator — Fonctionnalités de l'application

> Inventaire des fonctionnalités (frontend Angular + API .NET), univers **Eana (Dragons)**.  
> Dernière mise à jour : août 2026.

---

## 1. Pages et navigation

| Route | Description | Accès |
|-------|-------------|-------|
| `/` | Accueil, stats univers, liens création/codex | Public |
| `/create` | Assistant création de personnage (10–11 étapes) | Public |
| `/characters` | Bibliothèque de personnages (local ou cloud) | Public / cloud si connecté |
| `/character-sheet` | Fiche personnage + aperçu PDF | Public |
| `/story/create` | Assistant scénario / aventure (4 étapes) | Public |
| `/campaigns` | Campagnes MJ et joueur | Connecté |
| `/campaigns/:id` | Détail campagne (4 onglets) | Membres |
| `/friends` | Amis, demandes, invitations campagne | Connecté |
| `/login`, `/register` | Connexion / inscription | Public |
| `/confirm-email`, `/reset-password` | Confirmation email, reset MDP | Public (token URL) |
| `/settings` | Pseudo, mot de passe, renvoi confirmation | Connecté |
| `/support` | Tickets support + pièce jointe | Connecté |
| `/admin` | Admin utilisateurs et tickets | Admin |

### Codex (données de référence)

Routes lazy-loaded : `/species`, `/classes`, `/civilisations`, `/equipments`, `/spells`, `/creatures`, `/skills`, `/feats`, `/combat-actions`, `/deities` — chacune avec liste, résumé et fiches détail.

---

## 2. Création de personnage (wizard)

- **10 étapes** (sans magie) ou **11** (avec magie)
- **Niveaux 1–20** (choix verrouillé après l'étape Classe)
- Brouillon auto (localStorage), mode édition depuis la bibliothèque

| # | Étape | Contenu principal |
|---|--------|-------------------|
| 1 | Espèce | Peuple, sous-espèce, choix de création, traits raciaux |
| 2 | Civilisation | Origines, langues, écriture |
| 3 | Historique | Background prédéfini ou custom, équipement, handicaps |
| 4 | Classe | Classe, sous-classe, style, progression |
| 5 | Caractéristiques | Point-buy 15 pts, scores 6–15, ASI / dons |
| 6 | Savoirs & Maîtrises | Compétences, expertise, armes/outils classe |
| 7 | Équipement | Slots, alternatives, équipement auto |
| 8 | Langues | Langues fixes + bonus |
| 9 | Magie *(si lanceur)* | Sorts, grimoire, domaines, serments, etc. |
| 9/10 | Identité | Nom, alignement, personnalité, **IA backstory** |
| 10/11 | Récapitulatif | PDF, sauvegarde cloud, export |

**Export PDF** côté client (jsPDF), fiche calibrée sur fonds JPEG.

---

## 3. Création de scénario / aventure

Assistant **4 étapes** (`/story/create`) :

1. **Créatures** — sélection manuelle (1–20) ou auto (plages de niveau 1–2 … 17–20, 3–15 créatures)
2. **Personnages** — nom, rôle (antagoniste / allié / neutre / imprévisible), **IA vie & histoire** par créature
3. **Aventure** — titre, contexte, niveau groupe 1–20, ton, **IA aventure** (400–600 mots)
4. **Récapitulatif** — copie, export Markdown, PDF bestiaire / pack MJ, sauvegarde → campagne cloud

Brouillon localStorage avec reprise.

---

## 4. Personnages sauvegardés

- **Local** : `localStorage` sans compte
- **Cloud** : CRUD `/me/characters` (JWT)
- Actions : voir fiche, éditer, dupliquer, PDF, supprimer
- Sauvegarde en attente après login (personnage forgé avant inscription)

---

## 5. Campagnes multijoueur

- Création depuis **assistant scénario** ou bouton **Campagne vide** (Mes campagnes)
- **MJ** : édition, invitations amis, rencontres, XP, approbation persos joueurs
- **Joueur** : proposer un personnage cloud ; résumé perso (XP, sessions passées)
- Handouts carte : image PNG embarquée + légende des salles
- **4 onglets** : Vue d'ensemble, Créatures, Rencontres, Joueurs
- PDF campagne (bestiaire, pack MJ, fiches joueurs)

---

## 6. Comptes, auth et emails

- Inscription (email + pseudo + MDP 8+)
- Confirmation email obligatoire
- Login JWT, mot de passe oublié / reset (lien 2 h)
- Rôles **User** / **Admin**
- Emails SMTP (OVH Zimbra en prod, MailHog en local)

---

## 7. Support et administration

**Support** (`/support`)  
- Ticket : sujet, message, pièce jointe (PDF/PNG/JPG/WEBP, max 15 Mo), lien personnage optionnel

**Admin** (`/admin`)  
- Gestion utilisateurs (rôle, confirmation, reset MDP)
- Gestion tickets (statut, notes admin, téléchargement JSON personnage)

---

## 8. Génération IA (Groq)

| Endpoint | Usage | Modèle |
|----------|-------|--------|
| `POST /generate-backstory` | Histoire personnage (~100 mots) | `groq/compound` |
| `POST /generate-creature-story` | Vie créature scénario (~120 mots) | `groq/compound` |
| `POST /generate-adventure` | Aventure JDR structurée | `groq/compound` |

- Langue : **français uniquement**
- Rate limit prod : **30 req/h/IP** (anonyme), **60 req/h** (connecté)
- Config serveur : `Groq__ApiKey`, `Groq__Model` dans `.env`

---

## 9. API — domaines principaux

| Domaine | Exemples de routes |
|---------|-------------------|
| Auth | `/auth/register`, `/auth/login`, `/auth/me`, … |
| Personnages | `/me/characters`, `/me/characters/{id}` |
| Campagnes | `/me/campaigns`, invites, XP, approbation persos |
| Amis | `/users/search`, `/me/friends`, demandes |
| Support / Admin | `/support/tickets`, `/admin/users`, … |
| Codex | `/species`, `/classes`, `/creatures`, `/spells`, … (~90 endpoints lecture) |
| IA | `/generate-backstory`, `/generate-creature-story`, `/generate-adventure` |

Swagger : `/swagger` (API directe).

---

## 10. Déploiement

- **Prod** : `docker-compose.prod.yml` — nginx (443) + API .NET + SQLite persistant
- **CI** : GitHub Actions — tests unitaires, E2E Playwright, déploiement SSH
- **Domaine** : https://dragons-generator.top

---

## Synthèse

| Élément | Détail |
|---------|--------|
| Wizard personnage | 10–11 étapes, niveaux 1–20 |
| Wizard scénario | 4 étapes, IA créatures + aventure |
| Codex | 10 catégories navigables |
| Endpoints API | ~90 |
| Génération IA | 3 endpoints Groq |
| Alignements | 9 (D&D) |
| Point-buy | 15 points, scores 6–15 |
