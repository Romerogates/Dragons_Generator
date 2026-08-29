import { Injectable, inject } from '@angular/core';
import { forkJoin, firstValueFrom } from 'rxjs';
import { CharacterBuilderService } from './character-builder.service';
import { DataService } from './data.service';
import { CharacterCloudService } from './character-cloud.service';
import type { CampaignDetail } from '@core/models/Campaign/campaign';
import type { Character, EquipmentSlot } from '@core/models/Character/character';
import type { Background } from '@core/models/Backgrounds/background';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import type { Civilisation } from '@core/models/Civilisations/civilisations';
import type { Language } from '@core/models/Languages/language';
import type { Species } from '@core/models/Species/species';
import type { Spell } from '@core/models/Spells/spell';
import type { Skill } from '@core/models/Skills/skill';
import { normalizeBackgrounds } from '@core/utils/background-data.adapter';
import { normalizeCharacterClasses } from '@core/utils/class-data.adapter';
import {
  buildAutoBackgroundSelection,
  buildAutoClassSelection,
  buildAutoCivilizationSelection,
  buildAutoEquipment,
  buildAutoSpeciesSelection,
  buildAutoSpellcastingDetails,
  buildBackgroundToolSlots,
  buildStandardAbilityScores,
  autoPickClassSkills,
  autoResolveClassProficiencies,
  createSkillMapFromList,
  normalizeEquipmentCatalog,
  pickBonusLanguages,
  pickPlayableSpecies,
  pickPresetBackgrounds,
  primaryAbilityKeys,
  type EquipmentCatalogItem,
} from '@core/utils/character-auto-build.util';
import { pickRandom, randomHeroName } from '@core/utils/pregen-random.util';
import { validateCharacterExport } from '@core/utils/character-export-validation.util';
import { normalizeSkillId, type SkillInfo } from '@core/utils/skill.utils';
import type { GeneratedPregenCharacter } from './campaign-pregen-generator.service';
import { buildPregenPhysicalDescription } from '@core/utils/pregen-narrative.util';

interface GameCatalogs {
  species: Species[];
  classes: CharacterClass[];
  backgrounds: Background[];
  civilizations: Civilisation[];
  equipments: EquipmentCatalogItem[];
  skills: Record<string, SkillInfo>;
  languages: Language[];
  spells: Spell[];
}

@Injectable({ providedIn: 'root' })
export class CharacterAutoGeneratorService {
  private readonly builder = inject(CharacterBuilderService);
  private readonly data = inject(DataService);
  private readonly characters = inject(CharacterCloudService);

  async generateOriginalPlayable(
    campaign: CampaignDetail,
    withAiStory = true,
  ): Promise<GeneratedPregenCharacter> {
    const catalogs = await this.loadCatalogs();
    const maxAttempts = 12;
    let lastErrors: string[] = [];

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const character = this.buildRandomLevel1(catalogs);
        const validation = validateCharacterExport(character);
        if (!validation.valid) {
          lastErrors = validation.errors;
          continue;
        }

        const copy = structuredClone(character) as Character;
        copy.id = '';
        copy.cloudSynced = false;
        copy.name = `${character.name} (pré-tiré)`;
        const newId = await firstValueFrom(this.characters.save(copy));

        const speciesLabel = character.species.subspeciesLabel
          ? `${character.species.label} (${character.species.subspeciesLabel})`
          : character.species.label;
        const classLabel = character.classes.map((c) => c.classLabel).join(' / ') || '—';

        let publicHook = character.personality?.story?.trim() ?? '';
        let dmBackstory = publicHook;

        if (withAiStory) {
          try {
            const storyRes = await firstValueFrom(
              this.data.generateBackstory({
                name: copy.name,
                sex: character.personality?.sex ?? 'X',
                speciesName: character.species.label,
                subspeciesName: character.species.subspeciesLabel ?? undefined,
                civilizationName: character.civilization.label,
                className: classLabel,
                background: campaign.data.setting?.trim() || character.personality?.background || undefined,
                traits: character.personality?.traits || undefined,
                bonds: character.personality?.bonds || undefined,
                flaws: character.personality?.flaws || undefined,
                alignment: character.personality?.alignment || undefined,
              }),
            );
            dmBackstory = storyRes.story.trim();
            publicHook = dmBackstory.split(/[.!?]/)[0]?.trim() ?? dmBackstory.slice(0, 140);
          } catch {
            if (!publicHook) {
              publicHook = `${copy.name}, ${speciesLabel} ${classLabel}, prêt pour ${campaign.data.regionName || "l'aventure"}.`;
              dmBackstory = publicHook;
            }
          }
        }

        if (!dmBackstory) {
          dmBackstory = `${copy.name} est un héros prêt pour ${campaign.data.regionName || "l'aventure"}.`;
          publicHook = dmBackstory;
        }

        copy.id = newId;
        copy.cloudSynced = true;
        copy.personality = {
          ...copy.personality,
          story: dmBackstory,
          description:
            copy.personality?.description?.trim() ||
            buildPregenPhysicalDescription(copy, speciesLabel, classLabel),
        };
        await firstValueFrom(this.characters.save(copy, { updateExisting: true }));

        return {
          characterId: newId,
          characterName: copy.name,
          speciesLabel,
          classLabel,
          publicHook,
          dmBackstory,
        };
      } catch {
        continue;
      }
    }

    throw new Error(
      lastErrors.length
        ? `Génération impossible : ${lastErrors.join(' · ')}`
        : 'Génération impossible après plusieurs tentatives.',
    );
  }

  private async loadCatalogs(): Promise<GameCatalogs> {
    const res = await firstValueFrom(
      forkJoin({
        species: this.data.getSpecies(),
        classes: this.data.getClasses(),
        backgrounds: this.data.getBackgrounds(),
        civilizations: this.data.getCivilisations(),
        equipments: this.data.getEquipments(),
        skills: this.data.getSkills(),
        languages: this.data.getLanguages(),
        spells: this.data.getSpells(),
      }),
    );
    return {
      species: pickPlayableSpecies(res.species),
      classes: normalizeCharacterClasses(res.classes),
      backgrounds: pickPresetBackgrounds(normalizeBackgrounds(res.backgrounds)),
      civilizations: res.civilizations,
      equipments: normalizeEquipmentCatalog(res.equipments),
      skills: createSkillMapFromList(res.skills),
      languages: res.languages,
      spells: res.spells,
    };
  }

  private buildRandomLevel1(catalogs: GameCatalogs): Character {
    this.builder.reset();
    this.builder.setTargetLevel(1);

    const species = pickRandom(catalogs.species);
    const cls = pickRandom(catalogs.classes);
    const bg = pickRandom(catalogs.backgrounds);
    const civ = pickRandom(catalogs.civilizations);
    if (!species || !cls || !bg || !civ) {
      throw new Error('Catalogue incomplet');
    }

    const speciesSel = buildAutoSpeciesSelection(species);
    this.builder.setSpecies(speciesSel);
    this.builder.setCivilization(buildAutoCivilizationSelection(civ));

    const bgSel = buildAutoBackgroundSelection(bg, catalogs.skills);
    this.builder.setBackground(bgSel);

    const { selection, classChoiceAnswers, extraFeatures } = buildAutoClassSelection(cls, 1);
    this.builder.setClass(selection);
    this.builder.setClassProgressionChoices({
      classChoiceAnswers,
      extraFeatures,
    });

    const takenSkills = new Set<string>(bgSel.skills.map(normalizeSkillId));
    const classSkills = autoPickClassSkills(
      selection.skillOptions,
      selection.skillChooseCount,
      catalogs.skills,
      takenSkills,
    );
    classSkills.forEach((s) => takenSkills.add(normalizeSkillId(s)));

    const bgSkillChoose = bgSel.proficiencies?.skills?.chooseCount ?? 0;
    const bgSkillOpts = (bgSel.proficiencies?.skills?.options ?? []) as string[];
    const bgSkillsExtra =
      bgSkillChoose > 0
        ? autoPickClassSkills(
            bgSkillOpts.length ? bgSkillOpts : ['any'],
            bgSkillChoose,
            catalogs.skills,
            takenSkills,
          )
        : [];

    const speciesSkills = autoPickClassSkills(
      Object.keys(catalogs.skills),
      speciesSel.bonusSkillCount,
      catalogs.skills,
      takenSkills,
    );

    const weaponCatalog = catalogs.equipments
      .filter((e) => e.type === 'WEAPON')
      .map((e) => ({ id: e.id, costPo: Number(e.cost?.v ?? 0) || 0 }));
    const toolCatalog = catalogs.equipments.filter((e) => e.type === 'TOOL').map((e) => ({ id: e.id }));

    const cAfterClass = this.builder.creation();
    const profResolved = autoResolveClassProficiencies(
      cls,
      weaponCatalog,
      toolCatalog,
      cAfterClass.weaponProficiencies ?? [],
      [...(cAfterClass.toolProficiencies ?? []), ...(cAfterClass.backgroundTools ?? [])],
    );
    if (profResolved.weapons.length || profResolved.tools.length || Object.keys(profResolved.answers).length) {
      this.builder.mergeClassProficiencies(profResolved.weapons, profResolved.tools, profResolved.answers);
    }

    const resolvedBgTools = bgSel.tools.flatMap((t) => {
      if (t.includes('any') || t.includes('instrument') || t.includes('game')) return [];
      return [t.startsWith('tl-') ? t : t];
    });
    const bgToolSlots = buildBackgroundToolSlots(bgSel.tools, catalogs.equipments);
    this.builder.setProficiencies(
      [...classSkills, ...speciesSkills],
      [...bgSel.skills, ...bgSkillsExtra],
      resolvedBgTools,
      bgToolSlots,
    );

    const abilities = buildStandardAbilityScores(primaryAbilityKeys(cls));
    for (const [key, value] of Object.entries(abilities)) {
      this.builder.setAbilityScore(key as keyof typeof abilities, value);
    }

    const c = this.builder.creation();
    const cAny = c as {
      backgroundEquipmentSlots?: EquipmentSlot[];
      toolEquipmentSlots?: EquipmentSlot[];
    };
    const allSlots: EquipmentSlot[] = [
      ...(c.startingEquipmentSlots ?? []),
      ...(cAny.backgroundEquipmentSlots ?? []),
      ...(cAny.toolEquipmentSlots ?? []),
    ];
    const weaponProfs = this.builder.creation().weaponProficiencies ?? [];
    const toolProfs = [
      ...new Set([
        ...(this.builder.creation().toolProficiencies ?? []),
        ...(this.builder.creation().backgroundTools ?? []),
      ]),
    ];
    const equipment = buildAutoEquipment(allSlots, catalogs.equipments, weaponProfs, toolProfs);
    this.builder.setEquipment(equipment);

    const spellDetails = buildAutoSpellcastingDetails(
      cls,
      catalogs.spells,
      speciesSel.racialSpellGrants,
      speciesSel.choiceAnswers,
    );
    if (spellDetails) {
      this.builder.setSpellcastingDetails(spellDetails);
    }

    const lockedLangs = new Set(this.builder.creation().languages);
    const bonusNeeded = this.builder.creation().bonusLanguageCount ?? 0;
    if (bonusNeeded > 0) {
      const bonus = pickBonusLanguages(catalogs.languages, lockedLangs, bonusNeeded);
      this.builder.setLanguages([...lockedLangs, ...bonus]);
    }

    const sex = pickRandom(['M', 'F', 'X'] as const) ?? 'X';
    this.builder.setIdentity({
      name: randomHeroName(),
      sex,
      traits: bgSel.traits,
      ideal: bgSel.ideal,
      bonds: bgSel.bonds,
      flaws: bgSel.flaws,
      background: bgSel.backgroundText,
    });

    return this.builder.build();
  }
}
