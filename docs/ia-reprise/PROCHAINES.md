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

## À faire (priorité)

*(vide — feedback tests 2.1 traité. Suite = suite checklist manuelle.)*

**Livré suite feedback 2.1 :** mails parchemin + auto-login confirm ; pseudo navbar + cooldown 1×/sem ; wizard sans BM/PV trompeurs ; retour niveau espèce ; restore historique/personnalité ; modèles custom localStorage ; compétence/savoir +1 optionnel (custom) ; langues exotiques contraintes + source bonus ; totem druide icônes + lore.

**Tests manuels** : cocher `docs/CHECKLIST-TESTS-MANUELS.md`.

## Déjà livré (ne pas refaire)

- **Fiche de jeu (`character-play-view`)** — ressources sans doublons magie ; blocs Incantation (emplacements restants, pacte, grimoire) ; libellés FR ; spec (6).
- **Campagne table UX** — banner init seulement si PJ lié ; empty state `/init` + inline ; XP avec erreurs + lock + plus de `reload()` post-award ; labels FR (Lettre, Document, brouillard de guerre) ; util `campaign-initiative.util` + specs.
- **Wizard UX polish** — species : « Étape précédente » ; civ : « Continuer » si déjà confirmée ; background : restore custom + fallback pick si id manquant ; summary : erreur cloud visible (pas de navigation/reset), vousvoiement FR ; specs species/background/summary.
- **Spec identity-step** — `identity-step.spec.ts` (18) : résumé, sexe, confirm/prev, generateStory (validations, rate-limit, succès, erreurs API).
- **Lint warnings résiduels** — `npm run lint` clean (0) ; imports inutilisés, `prefer-const` PDF, `eqeqeq` initiative/timeline, `CharacterClass` abilities-step, filter magic-step, `no-case-declarations` équipements, `inject()` navbar.
- **Liste Héros (`characters.ts`)** — signals / getters / PDF / delete typés `Character` (+ `LegacyListFields` lecture seule) ; spec `characters.spec.ts` (15) ; plus de `$any` sur le confirm delete.
- **Languages / identity UX + typage** — `classJson: CharacterClass` ; erreur langues affichée ; catégories FR ; identity sexe typé, placeholders traits, résumé avec sous-classe.
- **Typage equipment-step + fiche** — `ExtendedCharacterCreation` ; `character-sheet` getSpecies/getClass typés.
- **Typage auth/admin** — `confirm-email` / `admin` / `AuthService.confirmEmail` ; import inutilisé campagne retiré.
- **Typage class / abilities / skills / magic** — plus de `any` sur ces étapes wizard.
- **Tests invites reject/decline** — cas limites API (decline, 404 tiers, non-ami 400, doublon 409, reject sans proposition).
- **Audit sorts `classes`** — 380/380 + `SpellDataIntegrityTests` ; BOM retirés.
- **Persistance table / campagne** — PUT sérialisés, pas de réapplication blob, debounce, flush cartes, `pinnedHandoutId`, poll initiative merge-only.
- **Quotas sorts JSON** — `spell-quota.util` ; magic-step + auto-build.
- **PDF / Ensorceleur / Paladin / Lettré / Magicien L17-L19** — déjà stabilisés (voir historique commits).
- Validation wizard = UI ; fiche HTML + PDF aperçu ; pacte secondaire ; SMTP prod ; guide badges.

## Comment choisir une tâche

Anthony dit ce qu’on attaque. File `PROCHAINES` planifiée = terminée.
