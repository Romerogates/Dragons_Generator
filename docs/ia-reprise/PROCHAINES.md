# Prochaines fonctionnalités / correctifs

Ordre = impact joueur. Ne pas relire tout le git : partir d’ici, puis ouvrir les fichiers de `FICHIERS.md`.

## Règles produit (ne pas casser)

- Univers **Eana / Dragons**, pas PHB anglophone par défaut.
- **`subcls-elu-arcanique` n’est pas l’Eldritch Knight PHB.** `resolveClassSpellcasting('cls-guerrier', 3, 'subcls-elu-arcanique')` doit rester `null`. Ne pas « corriger » ça en 1/3 lanceur PHB.
- **Import JSON joueur** : hors scope (pas d’UI d’import fichier perso).
- Ne pas committer `.env` / secrets. Commit + push seulement si Anthony le demande.
- UI touchée → vérifier dans le navigateur (pas juste un screenshot).
- PowerShell : `;` pas `&&`.
- Couverture Angular : **branches ≥ 90%** (karma) — si le seuil casse, ajouter des tests, ne pas baisser le seuil.
- **Pas de nouvelle feature** dans la passe polish : pas d’idle / Métiers / Bivouac, pas de routes session dédiées.

## À faire (priorité)

1. **Reste checklist** : amis/invites manuels ; face-à-face mobile ; jets/ordre de collecte init.
2. *(optionnel)* peaufinages mineurs guide / empty states hors flux critique.

## Déjà livré (ne pas refaire)

- **Plein écran UX** (2026-09-10) — icône maximize partagée (`app-fullscreen-enter-btn` / link) ; sortie **Escape** (Atlas, donjon, table `/play`, carnet Main, Codex sans bouton Fermer).
- **Atlas Eana plein écran** (2026-09-10) — `/civilisations` : icône + clic fond → overlay `Carte.jpg` + pins.
- **Éditeur donjon plein écran** (2026-09-10) — icône ; Escape sort du plein écran (pas de la liste).
- **Codex fiches overlay** (2026-09-10) — `app-codex-detail-shell` ; Escape / lien catalogue (*pas* l’Atlas).
- **Attaque joueur persistée** (2026-09-10) — `POST /me/campaigns/{id}/combat/resolve-attack` ; merge HP/journal vs PUT MJ stale ; front joueur plus de toast « MJ applique ».
- **Bulk Neutre → Allié/Adversaire** aussi en setup combat (raccourci play-panel).
- **Combat conditions + multi-attaques** — chips presets, édition en fight, +/✕ attaques.
- **Documents PDF.js + carnet Main** — aperçu page à page (nav tactile) ; export PNG/PDF/OCR déjà en place (export PNG en `.png`).
- **E2E attaque tour MJ** (2026-09-10) — `campaign-combat-attack.spec.ts` : Attaquer → clic carte → encode d20 → dégâts → PV/journal ; jet raté sans baisse PV. UX : clic cible passe au jet ; bandeau tour sticky.
- **E2E live polish 1–5** (2026-09-10) — `campaign-live-polish.spec.ts` : jet initiative joueur ; doc publié/épinglé (pas brouillon) ; mode session Autre (Encoder / Lancer le dé) ; XP offline erreur ; roster live MJ→joueur PV sans F5. Branches karma **≥ 90%**.
- **Smoke e2e combat/XP/init** (2026-09-10) — import party + Distribuer XP une fois ; banner initiative seulement si PJ lié ; documents type Lettre ; confirms in-app + home retry + dock joueur.

- Reset idle (Bivouac / Métiers / Missions retirés) ; baseline post-`c705f2a` + polish session.
- **V1 hub / session** — Préparer vs Jouer ; CTA **Entrer en session** ; combat seulement si `activeSessionId`.
- **Navbar** — Héros/Campagnes à gauche ; Forger/Scénario hors nav ; badges notifs = actions.
- **Notifs** — « Personnage approuvé » exige d’être encore membre ; hors compteurs d’action.
- Vague carnet + PDF + combat, fiche, wizard typage, invites, persistance table — voir historique.
- **P1 peaufiner campagne** (2026-09-07) — smoke hub → session → combat OK ; guide / e2e alignés « Entrer en session » ; boutons `+ Allié PNJ` / `+ Adversaire` rebranchés ; garde session + reset vue table au changement de session.
- **P3 navbar** (2026-09-07) — plus de truncature « Dragons Ge… » (mobile = `Generator` seul) ; pills Héros/Campagnes en `h-10`.
- **Hub 5 onglets** (2026-09-07) — nav Résumé · Sessions · Documents · Préparation · Joueurs ; Résumé = dashboard (état session, compteurs, synopsis RO, activité) ; Préparation = sous-onglets scénario / créatures / donjons / pré-tirés / rencontres / carnet ; setup-guide déplacé dans Préparation.

## Comment choisir une tâche

Anthony colle `PROMPT.md`. Sinon : checklist manuelle §5–6. File idle = **ne pas reprendre**.
