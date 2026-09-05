# Prochaines fonctionnalités / correctifs

Ordre = impact joueur. Ne pas relire tout le git : partir d’ici, puis ouvrir les fichiers de `FICHIERS.md`.

## Règles produit (ne pas casser)

- Univers **Eana / Dragons**, pas PHB anglophone par défaut.
- **`subcls-elu-arcanique` n’est pas l’Eldritch Knight PHB.** `resolveClassSpellcasting('cls-guerrier', 3, 'subcls-elu-arcanique')` doit rester `null`. Ne pas « corriger » ça en 1/3 lanceur PHB.
- **Import JSON joueur** : hors scope (pas d’UI d’import fichier perso).
- Ne pas committer `.env` / secrets. Commit + push seulement si Anthony le demande.
- UI touchée → vérifier dans le navigateur (pas juste un screenshot).

## À faire (priorité)

_(Backlog qualité vide — Anthony choisit le prochain sujet produit / polish.)_

## Déjà livré (ne pas refaire)

- **Typage class-step / abilities-step** — plus de `any` : `ClassChoicePool` / `FeatureJson` enrichi, helpers `asChoicePools`/`asFeatureJsonList` ; callbacks `Feat[]` / `Equipment[]` côté caracs.
- **Tests invites reject/decline** — cas limites API : decline + re-invite, decline par tiers → 404, non-ami → 400 / doublon pending → 409, reject perso sans proposition pending / non-MJ → 404.
- **Typage skills-step** — groupes outils (`BgToolChoiceGroup` / `ToolCatalogGroup`) + handlers UI ; `normalizeToolOption(unknown)` ; plus de `any` dans l’étape Compétences.
- **Typage magic-step** — `CharacterClass` / `SpellcastingDetailsDraft` ; plus de `any` dans l’étape Magie.
- **Audit sorts `classes`** — 380/380 JSON ont `classes` non vide ; 21 BOM UTF-8 retirés ; garde-fou `SpellDataIntegrityTests`.
- **Tests wizard** — specs déjà présentes : `class-step`, `skills-step`, `background-step`, `equipment-step`, `languages-step`, `magic-step`.
- **Tests API métier** — intégration déjà en place : `CharacterCampaignIntegrationTests`, `HomeAndCampaignFeatureTests` (invites), `FriendSupportIntegrationTests` (tickets).
- **Persistance table / campagne** — PUT sérialisés ; succès ne réapplique plus le blob envoyé (évite last-write-wins local) ; debounce notes/titre ; flush cartes donjon onDestroy / changement d’onglet / edit scénario ; `pinnedHandoutId` conservé au re-save story ; poll initiative = merge jets seulement ; navigation `/play` après PUT OK.
- **IDs d’équipement ambigus** — kits classes normalisés (moine fléchettes/cestes, munitions barbare/sorcier, sacs, druide serpe/masse, paladin focus, espion matériel de jeu) ; aliases + `item_id`/`quantity` dans `equipment.utils`.
- **PDF / Ensorceleur / Paladin** — overflow grimoire-supp ne perd plus de sorts ; `GRIMOIRE_SUPP_COORDS` centralisé ; métamagie FR + reverse map réédition ; sorts de serment restaurés à l’édition / extract JSON ; auras sous-classe annotées en auto-build.
- **Quotas de sorts depuis le JSON classe** — `resolveSpellQuota` (`spell-quota.util`) : `cantrips_known` / `spells_known` / grimoire / `prepared_formula` ; magic-step + auto-build branchés ; plus de table hardcodée niveau 1.
- **Fiche web** — compétences/outils/langues en libellés FR ; blocs magie (arcanes, invocations, métamagie, serment, maîtrise…) alignés sur le résumé PDF.
- **Lettré** — astuces multi-paliers (dédup + Empressement), conquêtes relecturables, PA persistés à l’édition, descriptions JSON, PDF ressources / Besace.
- **Magicien L17/L19** — Maîtrise des sorts + Sorts attitrés : choix Magie, validation wizard, persistance / réédition, fiche web + PDF.
- Validation wizard = UI (sous-classe, pacte primaire **et** secondaire, magie, équipement, langues).
- Fiche HTML de jeu + PDF en aperçu (`pdfFailed` ne vide plus la page).
- Pacte / invocations sorcier **classe secondaire**.
- SMTP prod : refuse `log` / `mailhog` / `localhost` sauf `Smtp:AllowLogSink` ; retry 3× ; seed admin + reset ciblé `Admin__Email`.
- Guide : sommaire scrollable ; badges « nouveau » hydratés au login (plus de 9+ faux).

## Comment choisir une tâche

Anthony dit ce qu’on attaque. Si « au jugé » : polish produit / UX / bugs signalés.
