# Priorité 1 — Peaufiner le flux campagne (pas de nouvelle feature)

Objectif : solidifier **ce qui existe** — créer → hub prep → entrer en session → init → combat → XP → terminer.  
Corriger uniquement frictions (libellés, empty states, mauvais CTA, badges morts).  
**Interdit** : idle / Métiers / Bivouac, wizard campagne V2, routes `/sessions/:id`, nouveaux onglets, redesign global.

## Flux à valider (smoke MJ + joueur)

1. Liste `/campaigns` → créer campagne vide ou scénario → arrive sur hub `/campaigns/:id` (prep, pas combat).
2. Résumé : zones **Préparer** vs **Jouer** ; CTA unique **Entrer en session** (ou planifier si aucune).
3. Onglet Sessions : bannière si session active ; sinon **Entrer** sur une `planned`.
4. Table (dock ou `/play`) : sans `activeSessionId` → empty state **sans** bouton Combattre.
5. Avec session : hub → Combattre → init → tours → XP une fois → Terminer la session.
6. Côté joueur : banner init seulement si PJ lié ; pas de faux « le MJ attend ».

## Frictions typiques à corriger (si trouvées)

| Symptôme | Où regarder |
|----------|-------------|
| Libellé « Démarrer la table » encore visible | `campaign-detail-sessions`, `campaign-play-panel`, setup-guide |
| Combattre accessible hors session | `campaign-play-panel.ts` (`enterCombatFlow`, `startCombatFromEncounter`) |
| Guide setup pousse le combat trop tôt | `campaign-setup-guide.util.ts` |
| Badge Campagnes / cloche fantôme | `NotificationService` + `NotificationsEndpoints` + prefs dismiss |
| Empty state joueur confus | `campaign-initiative*`, banner détail |

## Fichiers clés

- `DragonsGenerator.WEB/src/app/features/campaigns/campaigns.ts` (+ `.html`)
- `.../campaign-detail/campaign-detail.ts` (+ `.html`)
- `.../campaign-detail/campaign-detail-sessions/`
- `.../campaign-detail/campaign-setup-guide/`
- `.../campaign-play-panel/` (+ `campaign-play/`)
- `.../core/services/campaign-session-dock.service.ts`
- `.../shared/components/campaign-session-dock/`
- `docs/CHECKLIST-TESTS-MANUELS.md` §5.1–5.6 + §6

## Critères de done

- Aucune nouvelle feature produit.
- Parcours smoke ci-dessus OK en local (ou notes des bugs fixés).
- `npm test` branches ≥ 85 %, `npm run lint` clean.
- Commit/push **seulement si Anthony le demande** ; sinon laisser le diff.
- MAJ courte de `PROCHAINES.md` (ce qui a été peaufiné).

## Hors scope (rappels)

- Navbar redesign profond → voir `POLISH-P3-NAV.md` (cosmétique seulement).
- Checklist exhaustive cochée = bonus, pas bloquant si smoke P1 vert.
