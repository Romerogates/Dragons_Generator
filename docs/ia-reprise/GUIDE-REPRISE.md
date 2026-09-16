# Reprise — Guide (livrets PDF) + suite

Date : 2026-09-16  
Chat source : [Vague Fluide forge](51d40ab1-b83e-4344-9ea3-376b958b6d24)  
Repo : `D:\PROJECTS\DRAGONS_\DRAGONS_V2\Dragons_Generator_0.0.2\Dragons_Generator`  
Local : http://localhost:8081 (`docker compose -f docker-compose.local.yml` depuis la racine)

---

## Déjà livré (ne pas refaire)

### Structure Guide
- Hub `/guide` : 4 portes **MJ table / MJ en ligne / Joueur table / Joueur en ligne**
- Routes dédiées + redirects `mj` / `joueur` / `mj-debut` / `joueur-debut`
- Sommaire latéral : livrets + **Par classe** + aide du site
- Contenu style règles de jeu (objectif, formats, session, combat, compétences)
- Section **stats / d20 + mod + maîtrise** (explication + exemple `15 + 3 + 2 = 20`)
- Guides **par classe** (`/guide/classe/cls-*`) — martial sans section sorts (ex. barbare)
- Liens : fin de forge (Destin Scellé), Codex fiche classe, hub + sidebar

### Contenu IRL (2026-09-16 — vague fiche + glossaire + classe)
- Exemples **DD concrets Eana** (mur, garde, piste neige, temple…)
- Chapitre **Votre fiche annotée** (où lire score / mod / maîtrise / bonus d’attaque / CA / PV) — livrets table
- Bloc **Deux jets différents** (initiative ≠ toucher ≠ dégâts) — débutant absolu
- **Glossaire express** en fin des livrets table (CA, PV, DD, concentration…)
- Guides classe : section **Pièges du débutant** (2–3 par classe)
- Liens **Fiche Codex** + Joueur à la table depuis chaque guide classe
- Bouton **Pack débutant (PDF)** = livret joueur table + guide de la classe
- E2E : hub → mj-table PDF ; `/guide/classe/cls-barbare` → Pack + Codex
- **Mobile** : sidebar repliable (bouton Sommaire) ; CTA PDF pleine largeur ; ancres chapitres scrollables ; listes lisibles ; hub classes en grille 2 cols

### PDF
- Bouton **Télécharger le PDF** (livrets, aide du site, guides classe) — plus Imprimer comme CTA principal
- Fond **parchemin lavé** (~80 % blanc) + bordure fine ; texte sombre (économe encre, lisible N&B)
- Fichiers : `dragons-mj-a-la-table.pdf`, `dragons-mj-en-ligne.pdf`, `dragons-joueur-*.pdf`, `dragons-jouer-*.pdf`, `dragons-pack-debutant-{classe}.pdf`, `dragons-guide-{topicId}.pdf`

### Fichiers clés
| Rôle | Chemin |
|------|--------|
| Contenu 4 livrets | `DragonsGenerator.WEB/src/app/features/guide/guide-rulebooks.ts` |
| Guides classe | `…/guide/guide-class-playbooks.ts` |
| Page lecture | `…/guide/guide-rulebook.ts` + `.html` |
| PDF | `…/core/services/guide-rulebook-pdf.service.ts` |
| Hub / sidebar | `guide-index.*`, `guide-sidebar/guide-sidebar.ts` |
| Topics aide | `guide-topic.*`, `guide-topics.ts`, `guide-content.ts` |
| Routes | `app.routes.ts` (enfants `guide`) |
| Forge CTA | `character-creation/steps/summary-step/*` |
| Codex CTA | `data/characterClasses/character-class-detail/*` |

---

## Encore à faire (Guide) — priorisé

1. ~~Relire / étoffer contenu IRL (fiche annotée, DD Eana, init≠toucher)~~ **fait** (reste relecture Anthony à la table réelle)
2. ~~Guides classe (pièges, Codex, pack débutant)~~ **fait**
3. **Qualité PDF**  
   - Calibrer le voile parchemin (plus/moins blanc) après un vrai print test  
   - Sommaire PDF cliquable / page de garde « Dragons Generator — Règles débutant »  
   - Police un peu plus grande pour impression A4 (lisibilité table)
4. **Découvrabilité**  
   - Lien Guide depuis l’accueil / empty states campagne (« Première partie ? »)  
   - Badge « Nouveau » ou bandeau une fois sur `/guide`
5. **Tests**  
   - ~~E2E hub → mj-table + classe Pack/Codex~~ **fait** (partiel)  
   - Spec unitaire PDF (mock Image) optionnel
6. **Commit / push** — seulement si Anthony le demande (pas encore fait pour cette vague Guide)

---

## Améliorations suggérées (Guide)

- ~~Mini **glossaire 1 page** en fin de chaque livret table~~ **fait**
- **Checklist imprimable** détachable (MJ avant session / joueur avant soirée)
- Version **« 1 feuille recto »** ultra courte pour one-shot (en plus du livret long)
- Illustrations légères (schéma d’ordre d’initiative) en traits noirs — pas de gros aplats
- Alignement vocabulaire fiche PDF personnage ↔ livret (mêmes libellés)
- Relecture IRL Anthony : ajuster exemples DD / formulations après une vraie soirée

## Améliorations suggérées (reste du produit)

- Polish campagne / table (voir `POLISH-P1-CAMPAGNE.md` si encore ouvert)
- Empty states qui pointent vers le bon livret (MJ vs joueur, table vs online)
- Après validation d’un perso : toast / activité « Lire comment jouer [Classe] »
- Smoke manuel print : PDF mj-table + joueur-table + 1 guide classe / pack débutant sur imprimante réelle
- Ne pas rouvrir : idle / Bivouac / Métiers ; import JSON joueur ; Eldritch Knight PHB sur Élu arcanique

---

## Prompt à coller (nouvelle conversation)

```
Repo : D:\PROJECTS\DRAGONS_\DRAGONS_V2\Dragons_Generator_0.0.2\Dragons_Generator (branche main).
Univers Eana/Dragons. Je m’appelle Anthony.

Lis d’abord :
1. docs/ia-reprise/GUIDE-REPRISE.md  (ce fichier — état Guide + backlog)
2. docs/ia-reprise/PROCHAINES.md     (backlog global)
3. docs/ia-reprise/FICHIERS.md       seulement si tu touches hors Guide

Ne relis pas tout le git ni les transcripts. Commit/push seulement si je le demande.
PowerShell : ; pas &&. Docker web : docker compose -f docker-compose.local.yml up -d --build dragons-web depuis la racine → http://localhost:8081

Contexte Guide (déjà fait — ne pas refaire) :
- 4 livrets PDF séparés mj-table / mj-en-ligne / joueur-table / joueur-en-ligne
- Contenu stats + d20+mod+maîtrise ; combat initiative ≠ toucher ; compétences
- Fiche annotée + glossaire + DD Eana (livrets table)
- Guides par classe (pièges débutant) + liens Codex + Pack débutant PDF
- Liens hub, sidebar, forge (Destin Scellé), Codex classe
- PDF parchemin lavé (peu d’encre) via guide-rulebook-pdf.service.ts

Règles produit :
- subcls-elu-arcanique n’est PAS Eldritch Knight PHB
- Pas d’import JSON joueur ; pas de Bivouac/Métiers/idle

Tâche maintenant :
Reprends le backlog « Encore à faire (Guide) » de GUIDE-REPRISE.md, priorité 3 puis 4.
Commence par [PRÉCISER ICI : ex. « test print + calibrage parchemin » / « liens empty states » / « checklist imprimable »].
MAJ GUIDE-REPRISE.md et PROCHAINES.md en fin. Vas-y sans me demander confirmation à chaque micro-étape.
```

### Variantes (remplacer « Tâche maintenant »)

**PDF print**  
> Calibrer parchemin + typo impression ; tester un download mj-table. Pas de nouveau contenu long.

**Découvrabilité**  
> Liens Guide depuis empty campagne / post-validation perso / home. Pas de changement des textes de livret sauf libellés de boutons.

**Checklist / one-shot**  
> Ajouter checklist imprimable ou version « 1 feuille » dans guide-rulebooks.ts. Pas de refactor routes.

**Commit** (quand je le demande)  
> Commit clair sur la vague Guide (pas de dist/coverage), pas de push sauf si je dis push.
