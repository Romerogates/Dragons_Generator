# Prompt à coller (nouvelle conversation)

Copier-coller tel quel dans un chat neuf Cursor.

---

Repo : `D:\PROJECTS\DRAGONS_\DRAGONS_V2\Dragons_Generator_0.0.2\Dragons_Generator` (branche `main`).
Univers Eana/Dragons. Lis d’abord :

1. `docs/ia-reprise/PROCHAINES.md`
2. `docs/ia-reprise/POLISH-P1-CAMPAGNE.md` (priorité)
3. `docs/ia-reprise/POLISH-P3-NAV.md` (si P1 stable ou en parallèle léger)
4. `docs/ia-reprise/FICHIERS.md` — seulement les chemins du sujet

Ne relis pas tout le git ni les transcripts. **Pas de nouvelle feature** — peaufiner l’existant seulement.

Règles produit :
- `subcls-elu-arcanique` n’est PAS l’Eldritch Knight PHB ; `resolveClassSpellcasting('cls-guerrier', 3, 'subcls-elu-arcanique')` doit rester `null`.
- Pas d’UI d’import JSON joueur.
- Pas de Bivouac / Métiers / idle (retirés volontairement).
- Combat uniquement avec session active (`activeSessionId`).
- Commit/push seulement si je le demande.
- PowerShell : `;` pas `&&`.
- Couverture Angular branches ≥ 85 % — ne pas baisser le seuil.

Contexte récent (ne pas refaire) :
- Reset idle ; V1 hub prep vs « Entrer en session ».
- Navbar : Héros/Campagnes à gauche ; Forger/Scénario retirés.
- Notifs « personnage approuvé » : membre requis + hors badges action.

Tâche maintenant :
Exécute **Priorité 1** (`POLISH-P1-CAMPAGNE.md`) : smoke flux campagne, corrige uniquement les frictions trouvées. Ensuite **Priorité 3** (`POLISH-P3-NAV.md`) si le temps reste (truncature logo / densité). MAJ `PROCHAINES.md` en fin. Pas de feature nouvelle.

Vas-y sans me demander confirmation à chaque micro-étape.

---

## Variantes (remplacer le bloc « Tâche maintenant »)

**P1 seulement** :
> Uniquement `POLISH-P1-CAMPAGNE.md`. Pas de navbar sauf bug bloquant. MAJ `PROCHAINES.md`.

**P3 seulement** :
> Uniquement `POLISH-P3-NAV.md` (cosmétique navbar). Pas de changement campagne. MAJ `PROCHAINES.md`.

**Commit + deploy** (quand Anthony le demande) :
> Commit + push `main`, vérifier Deploy production (test/e2e/deploy), smoke https://dragons-generator.top. Corriger si CI rouge.
