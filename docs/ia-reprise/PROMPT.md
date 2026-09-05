# Prompt à coller (nouvelle conversation)

Copier-coller tel quel dans un chat neuf Cursor.

---

Repo : `D:\PROJECTS\DRAGONS_\DRAGONS_V2\Dragons_Generator_0.0.2\Dragons_Generator` (branche `main`).
Univers Eana/Dragons. Lis d’abord `docs/ia-reprise/PROCHAINES.md` puis `FICHIERS.md` — ne relis pas tout le git ni les transcripts.

Règles produit :
- `subcls-elu-arcanique` n’est PAS l’Eldritch Knight PHB ; `resolveClassSpellcasting('cls-guerrier', 3, 'subcls-elu-arcanique')` doit rester `null`.
- Pas d’UI d’import JSON joueur.
- Commit/push seulement si je le demande.
- PowerShell : utiliser `;` pas `&&`.
- Couverture Angular branches ≥ 85% (karma) — ne pas baisser le seuil ; ajouter des tests si besoin.

Contexte déjà livré (ne pas refaire) : voir section « Déjà livré » de `PROCHAINES.md` — typage wizard (magic/skills/class/abilities/equipment/languages/identity), fiche, auth/admin, invites decline/reject, persistance campagne, quotas sorts, audit sorts 380/380, PDF/Lettré/Magicien L17-19, deploy OK sur `762f662`.

Tâche maintenant (PROCHAINES #1) :
Typer les `any` résiduels dans `characters.ts` (liste Héros) en t’inspirant de `character-sheet`. Comportement inchangé. Lancer les specs / smoke concernés. Mettre à jour `PROCHAINES.md` quand c’est fait.

Vas-y sans me demander confirmation à chaque micro-étape.

---

## Variantes (remplacer le bloc « Tâche maintenant »)

**Lint** :
> PROCHAINES #2 — nettoyer les warnings lint résiduels (imports inutilisés, `===`, `const`) sans changer le comportement. `npm run lint` + tests si touchés. MAJ `PROCHAINES.md`.

**Au jugé** :
> Au jugé selon `PROCHAINES.md` (priorité #1 characters.ts, sinon lint, sinon UX wizard). MAJ `PROCHAINES.md` en fin.

**Commit + deploy** (quand Anthony le demande) :
> Commit + push `main`, vérifier le workflow Deploy production (test/e2e/deploy), smoke https://dragons-generator.top (health + Forger). Corriger si CI rouge.
