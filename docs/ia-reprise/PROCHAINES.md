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

_(File vide — smoke prod après deploy.)_

## Déjà livré (ne pas refaire)

- **Fluide 2 + boucles handoff** (2026-09-11) — CTA sticky + hints « Encore N » ; forge→propose campagne (`?campaignId`) ; feedback saut d’étape ; récap mobile = fiche UI ; bannière post-join/proposé ; empty Sessions + Planifier ; confirms Entrer en session / régénérer lien ; badge sync live ; fiche mobile UI par défaut ; liens Guide forge/hub ; chat amis → `/friends`.
- **Vague Fluide 1** (2026-09-11) — barre étapes cliquable ; Corriger une étape ; confirm brouillon ; sticky Continuer ; vousvoiement ; CTA post-join hub ; fiche consult /play ; dock vocabulaire ; e2e `/join`.
- **P3 fiche PJ depuis /play** (2026-09-11) — bloc « Héros à la table » + bouton Ma fiche / Fiche roster ; ouverture en mode `consult` avec retour `/campaigns/:id/play`.
- **P2 invitation + consultation** (2026-09-11) — lien `/join/{token}` (créer / régénérer / révoquer) sans amitié ; mode fiche `consult` (chat ami + pré-tirés / membres) ; pré-tirés `ready` visibles joueur ; `use-at-table` sans clone ; claim = copie optionnelle Mes héros.
- **P1 UX table joueur mobile** (2026-09-10) — adversaires d’abord ; roster compact + Tout voir ; bandeau tour sticky avec Attaquer/Passer ; menu combat avant les cartes ; carte fog repliable + cellule au viewport + scroll ; header `/play` sous navbar ; dock onglet Table → CTA plein écran (plus de panel écrasé).
- **P0 sync live SignalR** (2026-09-10) — hub `/hubs/campaign-live` ; push `campaignUpdated` sur PUT campagne / init / attaque / XP ; client `CampaignLiveService` ; poll de secours 30 s si hub OK (4 s sinon) ; merge MJ combat/fog sans écraser notes ; nginx WS + proxy `ws:true`.
- **Polish cloche / amis / onglets** (2026-09-10) — Discover Accepter/Refuser ; notif `xp_awarded` + push + préférence ; conflit MJ = banner Recharger/Garder ; smoke §10 coché (e2e).
- **XP joueur + amis e2e** (2026-09-10) — banner `+N XP reçue` (hub /play poll) ; activité `xp_awarded` loguée ; toasts amis accept/refus ; e2e UI amis/invites + XP visible joueur.
- **Polish reste** (2026-09-10) — toasts jets init + `turnOrderIds` figé ; sync MJ au focus si `updatedAt` plus récent ; empty states pré-tirés / rencontres / session ; setup-guide vousvoiement ; confirmation jet joueur avec total.
- **P2 live table** (2026-09-10) — édition combat repliée en fight (`Éditer combattants / roster`) ; face-à-face mobile (séparateur vs + bandeau tour sticky) ; fog live : carte de session active filtrée pour joueurs + canvas live + poll `/play` 4 s ; révélations fog persistées immédiatement.
- **P1 prépa session** (2026-09-10) — run sheet (objectifs / scènes / checklist) + `activeMapId` à la planification ; `playerRecap` à la fin de session (dialog Terminer) ; archive joueur si récap ; invites en attente MJ + copier lien Amis ; onglet Préparation masqué côté joueur sans pré-tiré ; API filtre run sheet, conserve récap/`activeMapId` ; `GET …/invites`.
- **P0 table joueur + init** (2026-09-10) — `/play` ouvert aux joueurs (badge Joueur) ; CTA « Rejoindre la table » sur Résumé ; bandeau init = dé + encode + total ; collecte MJ liste Alice ✓ / Bob… ; guide aligné (Préparation → Donjons, document, + Toute la party).
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
