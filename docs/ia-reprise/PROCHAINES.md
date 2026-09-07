# Prochaines fonctionnalités / correctifs

Ordre = impact joueur. Ne pas relire tout le git : partir d’ici, puis ouvrir les fichiers de `FICHIERS.md`.

## Règles produit (ne pas casser)

- Univers **Eana / Dragons**, pas PHB anglophone par défaut.
- **`subcls-elu-arcanique` n’est pas l’Eldritch Knight PHB.** `resolveClassSpellcasting('cls-guerrier', 3, 'subcls-elu-arcanique')` doit rester `null`. Ne pas « corriger » ça en 1/3 lanceur PHB.
- **Import JSON joueur** : hors scope (pas d’UI d’import fichier perso).
- Ne pas committer `.env` / secrets. Commit + push seulement si Anthony le demande.
- UI touchée → vérifier dans le navigateur (pas juste un screenshot).
- PowerShell : `;` pas `&&`.
- Couverture Angular : **branches ≥ 85%** (karma) — si le seuil casse, ajouter des tests, ne pas baisser le seuil.
- **Pas de nouvelle feature** dans la passe polish : pas d’idle / Métiers / Bivouac, pas de routes session dédiées.

## À faire (priorité)

1. **Tests manuels** : cocher `docs/CHECKLIST-TESTS-MANUELS.md` (§5–6) au fil des smokes restants (mode session, XP, joueur 2ᵉ compte) — revalider aussi la nav hub 5 onglets.
2. *(optionnel)* peaufinages mineurs guide / empty states hors flux critique.

## Déjà livré (ne pas refaire)

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
