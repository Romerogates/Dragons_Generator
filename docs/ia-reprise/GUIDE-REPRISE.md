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

1. ~~Relire / étoffer contenu IRL~~ **fait**
2. ~~Guides classe~~ **fait**
3. ~~Qualité PDF~~ **fait** (couverture + sommaire cliquable/signets ; typo A4 ↑ ; parchemin ~78 %)
4. ~~Découvrabilité~~ **fait**
5. ~~Checklists retirées~~ **fait**
6. ~~One-shot 1 feuille + schéma initiative + alignement libellés fiche~~ **fait**
7. ~~Polish campagne P1~~ **fait** (voir PROCHAINES)

---

## Améliorations suggérées (Guide)

- Relecture IRL Anthony après une vraie soirée
- Illustrations supplémentaires si besoin (au-delà du schéma initiative)

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
