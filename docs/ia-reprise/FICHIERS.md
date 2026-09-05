# Fichiers pour l’IA

Chemins depuis la racine du repo `Dragons_Generator`. Lire seulement ceux du sujet en cours.

## Contrat perso + wizard

- `DragonsGenerator.WEB/src/app/core/models/Character/character.ts`
- `DragonsGenerator.WEB/src/app/core/models/Character/character-builder.types.ts`
- `DragonsGenerator.WEB/src/app/core/services/character-builder.service.ts`
- `DragonsGenerator.WEB/src/app/core/utils/character-build.util.ts`
- `DragonsGenerator.WEB/src/app/core/utils/character-edit.mapper.ts`
- `DragonsGenerator.WEB/src/app/core/utils/character-wizard-validation.util.ts`
- `DragonsGenerator.WEB/src/app/core/utils/class-spellcasting.util.ts`
- `DragonsGenerator.WEB/src/app/core/utils/spell-quota.util.ts`
- `DragonsGenerator.WEB/src/app/core/utils/character-spellcasting.util.ts`
- `DragonsGenerator.WEB/src/app/core/utils/progression-choices.util.ts`
- `DragonsGenerator.WEB/src/app/features/character-creation/character-creation.ts`

## Étapes wizard

- `.../steps/level-step/level-step.ts`
- `.../steps/species-step/species-step.ts`
- `.../steps/civilization-step/civilization-step.ts`
- `.../steps/background-step/background-step.ts`
- `.../steps/class-step/class-step.ts`
- `.../steps/class-step/multiclass-panel/multiclass-panel.ts`
- `.../steps/abilities-step/abilities-step.ts`
- `.../steps/skills-step/skills-step.ts`
- `.../steps/equipment-step/equipment-step.ts`
- `.../steps/languages-step/languages-step.ts`
- `.../steps/magic-step/magic-step.ts`
- `.../steps/identity-step/identity-step.ts`
- `.../steps/summary-step/summary-step.ts`

(`...` = `DragonsGenerator.WEB/src/app/features/character-creation`)

## Fiche + PDF

- `DragonsGenerator.WEB/src/app/features/character-sheet/character-sheet.ts`
- `DragonsGenerator.WEB/src/app/features/character-sheet/character-play-view.ts`
- `DragonsGenerator.WEB/src/app/core/services/pdf-generator.service.ts`
- `DragonsGenerator.WEB/src/app/core/config/grimoire-coords.config.ts`

## Données jeu (source de vérité)

- `DragonsGenerator.API/Data/Classes/` (`cls-*.json`)
- `DragonsGenerator.API/Data/Spells/`
- `DragonsGenerator.API/Data/index/`
- `DragonsGenerator.API/Common/GameDataRepository.cs`

## API auth / mail / persos / campagnes

- `DragonsGenerator.API/Program.cs`
- `DragonsGenerator.API/Endpoints/Auth/AuthEndpoints.cs`
- `DragonsGenerator.API/Services/EmailSender.cs`
- `DragonsGenerator.API/Services/DbSeeder.cs`
- `DragonsGenerator.API/Services/ProductionConfigGuard.cs`
- `DragonsGenerator.API/Endpoints/Characters/CharacterCrudEndpoints.cs`
- `DragonsGenerator.API/Endpoints/Campaigns/CampaignEndpoints.cs`
- `DragonsGenerator.API/Persistence/AppDbContext.cs`
- `DragonsGenerator.API/Persistence/Entities.cs`

## Campagne front (si sujet table)

- `DragonsGenerator.WEB/src/app/features/campaigns/campaign-detail/campaign-detail.ts`
- `DragonsGenerator.WEB/src/app/features/campaigns/campaign-play-panel/campaign-play-panel.ts`
- `DragonsGenerator.WEB/src/app/features/campaigns/campaign-dungeon-maps/campaign-dungeon-maps.ts`
- `DragonsGenerator.WEB/src/app/core/utils/campaign-persist.util.ts`
- `DragonsGenerator.WEB/src/app/core/services/story-builder.service.ts`
- `DragonsGenerator.WEB/src/app/core/services/campaign-cloud.service.ts`
- `DragonsGenerator.WEB/src/app/core/services/campaign-pdf.service.ts`

## Guide / nav

- `DragonsGenerator.WEB/src/app/features/guide/guide.ts`
- `DragonsGenerator.WEB/src/app/core/services/guide-preferences.service.ts`
- `DragonsGenerator.WEB/src/app/shared/components/navbar/navbar.ts`
- `DragonsGenerator.WEB/src/app/app.routes.ts`

## Ops

- `README.md`
- `docs/FONCTIONNALITES.md`
- `docs/DEPLOY-PROD.md`
- `.env.example`
- `docker-compose.local.yml`
- `docker-compose.prod.yml`
- `.github/workflows/deploy.yml`
- `scripts/start-local.ps1`
- `scripts/run-tests.ps1`
