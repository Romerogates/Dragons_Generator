import { abilityLabelToKey, type Character, type SpellInstance } from '@core/models/Character/character';
import type { Spell } from '@core/models/Spells/spell';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import {
  INITIAL_CREATION_STATE,
  type ExtendedCharacterCreation,
  type SecondaryClassSelection,
} from '@core/models/Character/character-builder.types';
import type { CharacterBuildEditingRef } from './character-build.util';
import { aggregateAsiChoices, subtractPartialScores } from './character-abilities.util';
import type { RawFeatData } from './feat-benefits.util';
import { buildSecondaryClassSelection } from './class-spellcasting.util';

/** Contexte optionnel permettant de ré-agréger fidèlement les dons (ASI fixe/flexible,
 * darkvision, résistances, don "Talent" à 4 points…) à partir des catalogues chargés côté
 * appelant. Sans ce contexte, les bonus déjà appliqués au personnage sauvegardé restent
 * corrects (ils sont fusionnés dans `saved.*`), mais les caches `creation.talentBonus*` /
 * `creation.featBonus*` ne sont recalculés qu'à la ré-confirmation de l'étape Caractéristiques. */
export interface CharacterEditMapperContext {
  feats?: Map<string, RawFeatData>;
  spells?: Map<string, Spell>;
  classes?: Map<string, CharacterClass>;
}

export interface CharacterEditLoadResult {
  creation: ExtendedCharacterCreation;
  editing: CharacterBuildEditingRef;
}

/** Vérifie qu'un export cloud peut être rechargé dans le wizard. */
export function validateCharacterForEdit(saved: Character): string[] {
  const errors: string[] = [];
  if (!saved.id?.trim()) errors.push('identifiant manquant');
  if (!saved.species?.id) errors.push('espèce manquante');
  if (!saved.civilization?.id) errors.push('civilisation manquante');
  if (!saved.classes?.length || !saved.classes[0]?.classId) errors.push('classe manquante');
  if (!saved.abilities) errors.push('caractéristiques manquantes');
  return errors;
}

/** Reconstruit l'état wizard à partir d'un personnage sauvegardé. */
export function mapCharacterToEditState(
  saved: Character,
  ctx?: CharacterEditMapperContext,
): CharacterEditLoadResult {
  const creation = structuredClone(INITIAL_CREATION_STATE);
  const species = saved.species;
  const primaryClass = saved.classes[0];
  const sc = saved.spellcasting;

  creation.speciesId = species.id;
  creation.speciesName = species.label;
  creation.subspeciesId = species.subspeciesId ?? null;
  creation.subspeciesName = species.subspeciesLabel ?? null;
  creation.speciesTraits = saved.features.filter(
    (f) => f.source === 'species' || f.source === 'subspecies',
  );
  creation.speciesSpeed = saved.movement.walk;
  creation.speciesSize = saved.size;
  creation.speciesResistances = saved.defense.resistances;
  creation.hasDarkvision = saved.senses.hasDarkvision;
  creation.darkvisionRadius = saved.senses.darkvisionRadius;

  creation.civilizationId = saved.civilization.id;
  creation.civilizationName = saved.civilization.label;
  creation.civilizationWritingSystems = saved.proficiencies.writingSystems;

  creation.backgroundId = saved.backgroundRef?.id ?? null;
  creation.backgroundName = saved.backgroundRef?.label ?? null;
  creation.backgroundPreset = saved.backgroundRef !== null;
  creation.privilegeId = saved.privilegeRef?.id ?? null;
  creation.privilegeName = saved.privilegeRef?.name ?? null;
  creation.privilegeDesc = saved.privilegeRef?.desc ?? null;

  creation.classId = primaryClass?.classId ?? null;
  creation.className = primaryClass?.classLabel ?? null;
  creation.subclassId = primaryClass?.subclassId ?? null;
  creation.subclassName = primaryClass?.subclassLabel ?? null;
  // Niveau de la classe PRIMAIRE uniquement (pas `saved.totalLevel`, qui inclut les classes de
  // multiclassage reconstruites séparément ci-dessous dans `secondaryClasses`).
  creation.targetLevel = primaryClass?.level || 1;
  creation.hitDie = primaryClass?.hitDie ?? 0;
  creation.hpAtLevel1 = primaryClass?.hitDie ?? 0;
  creation.hpPerLevelAverage = primaryClass?.hitDie
    ? Math.floor(primaryClass.hitDie / 2) + 1
    : 0;
  creation.hasSpellcasting = sc !== null || (saved.secondaryClassSelections ?? []).some((s) => s.hasSpellcasting);
  creation.spellcastingKind = sc?.kind ?? null;
  creation.spellcastingAbility = sc?.ability ?? null;
  creation.savingThrows = saved.proficiencies.savingThrows;
  creation.armorProficiencies = saved.proficiencies.armor;
  creation.weaponProficiencies = saved.proficiencies.weapons;
  creation.toolProficiencies = saved.proficiencies.tools;
  creation.skillChooseCount = saved.proficiencies.skills.length;
  creation.classFeatures = saved.features.filter(
    (f) => f.source === 'class' || f.source === 'subclass',
  );
  creation.expertiseSkills = saved.proficiencies.expertiseSkills ?? [];
  creation.secondaryClasses = restoreSecondaryClasses(saved, ctx?.classes);
  const secondaryFeatIds = new Set(
    (creation.secondaryClasses ?? []).flatMap((sc) => sc.classFeatures.map((f) => f.refId).filter(Boolean)),
  );
  if (secondaryFeatIds.size) {
    creation.classFeatures = creation.classFeatures.filter((f) => !secondaryFeatIds.has(f.refId));
  }
  if (ctx?.classes && primaryClass?.classId) {
    const primaryCls = ctx.classes.get(primaryClass.classId);
    if (primaryCls?.data?.proficiencies?.skills) {
      creation.skillChooseCount =
        primaryCls.data.proficiencies.skills.count ?? creation.skillChooseCount;
      const opts = primaryCls.data.proficiencies.skills.options;
      if (Array.isArray(opts)) creation.skillOptions = opts;
    }
  }
  // Restaure les choix de progression (ancêtre draconique, domaine, métamagie…) et les dons/ASI
  // pour que la réédition à un niveau supérieur ne perde pas les choix déjà faits.
  creation.classChoiceAnswers = saved.classChoiceAnswers ?? {};
  creation.asiChoices = saved.asiChoices ?? [];
  if (creation.asiChoices.length) {
    // On repasse le contexte (dons + sorts) quand l'appelant le fournit, pour que les bonus
    // dérivés des dons (darkvision, armure, résistances, don "Talent" à 4 points…) soient
    // recalculés fidèlement dès le chargement, sans attendre que le joueur retraverse l'étape
    // Caractéristiques. Sans contexte (ex. anciens appels/tests), on se limite au strict
    // minimum (ASI + liste des dons), comme avant.
    const agg = aggregateAsiChoices(creation.asiChoices, {
      feats: ctx?.feats,
      spells: ctx?.spells,
      spellcastingAbility: sc?.ability ? abilityLabelToKey(sc.ability) : null,
    });
    creation.asiBonuses = agg.bonuses;
    creation.selectedFeatIds = agg.featIds;
    creation.selectedFeatId = agg.featIds[0] ?? null;
    creation.featDarkvisionRadius = agg.featDarkvisionRadius;
    creation.featBonusArmor = agg.featBonusArmor;
    creation.featBonusTools = agg.featBonusTools;
    creation.featResistances = agg.featResistances;
    creation.talentBonusSkills = agg.talentBonusSkills;
    creation.talentExpertiseSkills = agg.talentExpertiseSkills;
    creation.talentBonusWeapons = agg.talentBonusWeapons;
    creation.talentSavingThrows = agg.talentSavingThrows;
    creation.talentBonusCantrips = agg.talentBonusCantrips;
    creation.bonusLanguageCount = (creation.bonusLanguageCount || 0) + agg.talentBonusLanguageCount;
    creation.requiredExoticLanguageCount =
      (creation.requiredExoticLanguageCount || 0) + agg.talentRequiredExoticLanguages;
    creation.talentBonusLangApplied = agg.talentBonusLanguageCount;
    creation.talentExoticLangApplied = agg.talentRequiredExoticLanguages;
  }

  if (sc?.kind === 'sorcerer') {
    creation.metamagicOptions = sc.metamagic ?? [];
  }
  if (sc?.kind === 'warlock') {
    creation.eldritchInvocations = sc.eldritchInvocations ?? [];
    creation.pactBoon = sc.pact || null;
    creation.mysticArcanumPicks = Object.fromEntries(
      (sc.mysticArcanum ?? []).map((a) => [String(a.spellLevel), a.spellId]),
    );
  } else {
    const warlockSecondary = saved.secondaryClassSelections?.find((s) => s.classId === 'cls-sorcier');
    if (warlockSecondary) {
      creation.eldritchInvocations = warlockSecondary.eldritchInvocations ?? [];
      creation.pactBoon = warlockSecondary.pactBoon ?? null;
    }
  }
  if (sc?.kind === 'wizard') {
    creation.spellMasteryPicks = Object.fromEntries(
      (sc.spellMastery ?? []).map((a) => [String(a.spellLevel), a.spellId]),
    );
    creation.signatureSpellIds = (sc.signatureSpells ?? []).map((s) => s.spellId);
  }

  const snapshot = saved.wizardAbilitySnapshot;
  if (snapshot?.baseAbilities) {
    creation.baseAbilities = snapshot.baseAbilities;
    creation.racialBonuses = snapshot.racialBonuses ?? {};
  } else {
    creation.baseAbilities = subtractPartialScores(
      saved.abilities,
      creation.asiBonuses ?? {},
    );
  }
  creation.pointsRemaining = 0;
  creation.selectedSkills = saved.proficiencies.skills;
  creation.selectedEquipment = saved.equipment;
  creation.currency = saved.currency;
  creation.languages = saved.proficiencies.languages;

  creation.name = saved.name;
  creation.sex = saved.personality.sex ?? 'X';
  creation.description = saved.personality.description;
  creation.background = saved.personality.background;
  creation.alignment = saved.personality.alignment;
  creation.traits = saved.personality.traits;
  creation.ideal = saved.personality.ideal;
  creation.bonds = saved.personality.bonds;
  creation.flaws = saved.personality.flaws;
  creation.handicap = saved.personality.handicap;
  creation.story = saved.personality.story;

  creation.spellcastingDetails = mapKnownSpellsToSpellcastingDetails(saved.knownSpells);

  return {
    creation,
    editing: {
      id: saved.id,
      createdAt: saved.createdAt,
      cloudSynced: saved.cloudSynced === true,
    },
  };
}

function mapKnownSpellsToSpellcastingDetails(
  knownSpells: SpellInstance[],
): ExtendedCharacterCreation['spellcastingDetails'] {
  if (!knownSpells.length) return {};
  return {
    cantrips: knownSpells
      .filter((s) => s.level === 0)
      .map((s) => ({
        refId: s.refId,
        name: s.name,
        level: 0,
        prepared: true,
        effectSummary: s.effectSummary ?? '',
      })),
    spells: knownSpells
      .filter((s) => s.level >= 1)
      .map((s) => ({
        refId: s.refId,
        name: s.name,
        level: s.level,
        prepared: s.prepared,
        effectSummary: s.effectSummary ?? '',
      })),
  };
}

function restoreSecondaryClasses(
  saved: Character,
  classes?: Map<string, CharacterClass>,
): SecondaryClassSelection[] {
  const persisted = saved.secondaryClassSelections;
  if (persisted?.length) {
    return persisted.map((sc) => ({
      ...sc,
      subclassId: sc.subclassId ?? null,
      subclassName: sc.subclassName ?? null,
    }));
  }
  return saved.classes.slice(1).map((cls): SecondaryClassSelection => {
    const catalog = classes?.get(cls.classId);
    if (catalog) {
      return buildSecondaryClassSelection(
        catalog,
        cls.level,
        cls.subclassId ?? null,
        cls.subclassLabel ?? null,
      );
    }
    return {
      classId: cls.classId,
      className: cls.classLabel,
      subclassId: cls.subclassId ?? null,
      subclassName: cls.subclassLabel ?? null,
      level: cls.level,
      hitDie: cls.hitDie,
      hpPerLevelAverage: Math.floor(cls.hitDie / 2) + 1,
      hasSpellcasting: false,
      spellcastingKind: null,
      spellcastingAbility: null,
      armorProficiencies: [],
      weaponProficiencies: [],
      toolProficiencies: [],
      skillChooseCount: 0,
      skillOptions: [],
      classFeatures: [],
    };
  });
}
