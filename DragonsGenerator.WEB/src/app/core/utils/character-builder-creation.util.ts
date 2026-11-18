import type { FeatureInstance, Size } from '../models/Character/character';
import type {
  BackgroundSelection,
  CivilizationSelection,
  ClassSelection,
  ExtendedCharacterCreation,
  SecondaryClassSelection,
  SpeciesSelection,
} from '../models/Character/character-builder.types';
import { mergeCreationLanguages } from './character-languages.util';
import { coerceEquipmentSlots } from './class-data.adapter';
import { normalizeBackgroundSkillId } from './character-proficiencies.util';

export function applySpeciesSelection(
  c: ExtendedCharacterCreation,
  selection: SpeciesSelection,
): ExtendedCharacterCreation {
  const prevSpBonus = c.speciesBonusLangApplied ?? 0;
  const newBonusTotal = (c.bonusLanguageCount || 0) - prevSpBonus + selection.bonusLanguageCount;
  return {
    ...c,
    speciesId: selection.speciesId,
    speciesName: selection.speciesName,
    subspeciesId: selection.subspeciesId,
    subspeciesName: selection.subspeciesName,
    racialBonuses: selection.racialBonuses,
    speciesTraits: selection.traits,
    speciesSpeed: selection.speed,
    speciesSize: selection.size,
    speciesLanguages: selection.languages,
    speciesResistances: selection.resistances,
    hasDarkvision: selection.hasDarkvision,
    darkvisionRadius: selection.darkvisionRadius,
    speciesFixedSkills: selection.bonusSkills ?? [],
    speciesFixedWeapons: selection.bonusWeapons ?? [],
    speciesFixedArmor: selection.bonusArmor ?? [],
    speciesFixedTools: selection.bonusTools ?? [],
    speciesInnateSpells: selection.innateSpells ?? [],
    speciesChoiceAnswers: selection.choiceAnswers,
    speciesBonusSkillCount: selection.bonusSkillCount,
    speciesBonusToolCount: selection.bonusToolCount,
    speciesBonusToolPoolIds: selection.bonusToolPoolIds ?? [],
    speciesBonusToolChoiceLabel: selection.bonusToolChoiceLabel ?? '',
    racialSpellGrants: selection.racialSpellGrants,
    bonusLanguageCount: newBonusTotal,
    speciesBonusLangApplied: selection.bonusLanguageCount,
    languages: mergeCreationLanguages(selection.languages, c.civilizationLanguages, c.backgroundLanguages),
  };
}

export function clearSpeciesSelection(c: ExtendedCharacterCreation): ExtendedCharacterCreation {
  const prevSpBonus = c.speciesBonusLangApplied ?? 0;
  return {
    ...c,
    speciesId: null,
    speciesName: null,
    subspeciesId: null,
    subspeciesName: null,
    racialBonuses: {},
    speciesTraits: [],
    speciesSpeed: 9,
    speciesSize: 'M' as Size,
    speciesLanguages: [],
    speciesResistances: [],
    hasDarkvision: false,
    darkvisionRadius: 0,
    speciesFixedSkills: [],
    speciesFixedWeapons: [],
    speciesFixedArmor: [],
    speciesFixedTools: [],
    speciesInnateSpells: [],
    speciesChoiceAnswers: {},
    speciesBonusSkillCount: 0,
    speciesBonusToolCount: 0,
    speciesBonusToolPoolIds: [],
    speciesBonusToolChoiceLabel: '',
    racialSpellGrants: [],
    bonusLanguageCount: (c.bonusLanguageCount || 0) - prevSpBonus,
    speciesBonusLangApplied: 0,
    languages: mergeCreationLanguages(c.civilizationLanguages, c.backgroundLanguages),
  };
}

export function applyCivilizationSelection(
  c: ExtendedCharacterCreation,
  selection: CivilizationSelection,
): ExtendedCharacterCreation {
  return {
    ...c,
    civilizationId: selection.civilizationId,
    civilizationName: selection.civilizationName,
    civilizationLanguages: selection.languages,
    civilizationWritingSystems: selection.writingSystems,
    languages: mergeCreationLanguages(c.speciesLanguages, selection.languages, c.backgroundLanguages),
  };
}

export function clearCivilizationSelection(c: ExtendedCharacterCreation): ExtendedCharacterCreation {
  return {
    ...c,
    civilizationId: null,
    civilizationName: null,
    civilizationLanguages: [],
    civilizationWritingSystems: [],
    languages: mergeCreationLanguages(c.speciesLanguages, c.backgroundLanguages),
  };
}

export function applyBackgroundSelection(
  c: ExtendedCharacterCreation,
  selection: BackgroundSelection,
): ExtendedCharacterCreation {
  const prevBgBonus = c.backgroundBonusLangApplied ?? 0;
  const newBonusTotal = (c.bonusLanguageCount || 0) - prevBgBonus + selection.bonusLanguageCount;
  return {
    ...c,
    backgroundId: selection.backgroundId,
    backgroundName: selection.backgroundName,
    backgroundPreset: selection.backgroundPreset,
    backgroundProficiencies: selection.proficiencies ?? null,
    backgroundSkills: (selection.skills ?? []).map(normalizeBackgroundSkillId),
    backgroundTools: [],
    toolEquipmentSlots: [],
    backgroundLanguages: [],
    backgroundEquipment: selection.equipment,
    backgroundEquipmentSlots: selection.equipmentSlots,
    backgroundCurrency: selection.currency,
    privilegeId: selection.privilegeId,
    privilegeName: selection.privilegeName,
    privilegeDesc: selection.privilegeDesc,
    selectedHandicaps: selection.selectedHandicaps,
    handicapCompensationType: selection.handicapCompensationType,
    background: selection.backgroundText || c.background,
    traits: selection.traits || c.traits,
    ideal: selection.ideal || c.ideal,
    bonds: selection.bonds || c.bonds,
    flaws: selection.flaws || c.flaws,
    handicap: selection.handicap || c.handicap,
    bonusLanguageCount: newBonusTotal,
    backgroundBonusLangApplied: selection.bonusLanguageCount,
    languages: mergeCreationLanguages(c.speciesLanguages, c.civilizationLanguages),
  };
}

export function clearBackgroundSelection(c: ExtendedCharacterCreation): ExtendedCharacterCreation {
  const prevBgBonus = c.backgroundBonusLangApplied ?? 0;
  return {
    ...c,
    backgroundId: null,
    backgroundName: null,
    backgroundPreset: false,
    backgroundSkills: [],
    backgroundTools: [],
    backgroundProficiencies: null,
    backgroundLanguages: [],
    backgroundEquipment: [],
    backgroundEquipmentSlots: [],
    toolEquipmentSlots: [],
    backgroundCurrency: { cuivre: 0, argent: 0, or: 0, platine: 0 },
    privilegeId: null,
    privilegeName: null,
    privilegeDesc: null,
    selectedHandicaps: [],
    handicapCompensationType: null,
    background: '',
    traits: '',
    ideal: '',
    bonds: '',
    flaws: '',
    handicap: '',
    bonusLanguageCount: (c.bonusLanguageCount || 0) - prevBgBonus,
    backgroundBonusLangApplied: 0,
    languages: mergeCreationLanguages(c.speciesLanguages, c.civilizationLanguages),
  };
}

export function applyClassSelection(
  c: ExtendedCharacterCreation,
  selection: ClassSelection,
  opts?: { preserveProgress?: boolean },
): ExtendedCharacterCreation {
  const preserve = opts?.preserveProgress === true;
  const prevClassLang = c.classBonusLanguageCount ?? 0;
  const newClassLang = selection.classBonusLanguageCount ?? 0;
  return {
    ...c,
    classId: selection.classId,
    className: selection.className,
    subclassId: selection.subclassId ?? null,
    subclassName: selection.subclassName ?? null,
    hitDie: selection.hitDie,
    hpAtLevel1: selection.hpAtLevel1 && selection.hpAtLevel1 > 0 ? selection.hpAtLevel1 : selection.hitDie,
    hpPerLevelAverage:
      selection.hpPerLevelAverage && selection.hpPerLevelAverage > 0
        ? selection.hpPerLevelAverage
        : Math.floor(selection.hitDie / 2) + 1,
    hasSpellcasting: selection.hasSpellcasting,
    spellcastingKind: selection.spellcastingKind,
    spellcastingAbility: selection.spellcastingAbility,
    savingThrows: selection.savingThrows,
    armorProficiencies: selection.armorProficiencies,
    weaponProficiencies: selection.weaponProficiencies,
    toolProficiencies: selection.toolProficiencies,
    skillOptions: selection.skillOptions,
    skillChooseCount: selection.skillChooseCount,
    classFeatures: selection.classFeatures,
    startingEquipmentSlots: coerceEquipmentSlots(selection.startingEquipmentSlots),
    classProgressionResources: selection.classProgressionResources ?? {},
    classBonusLanguageCount: newClassLang,
    classSpellSlots: selection.classSpellSlots ?? [],
    classResistances: selection.classResistances ?? [],
    classDarkvisionRadius: selection.classDarkvisionRadius ?? 0,
    classHasBlindsight: selection.classHasBlindsight ?? false,
    classBlindsightRadius: selection.classBlindsightRadius ?? 0,
    bonusLanguageCount: (c.bonusLanguageCount || 0) - prevClassLang + newClassLang,
    requiredExoticLanguageCount: selection.classRequiredExoticLanguageCount ?? 0,
    requiredBaseLanguageCount: selection.classRequiredBaseLanguageCount ?? 0,
    classChoiceAnswers: preserve ? c.classChoiceAnswers : {},
    asiBonuses: preserve ? c.asiBonuses : {},
    selectedFeatId: preserve ? c.selectedFeatId : null,
    selectedFeatIds: preserve ? c.selectedFeatIds : [],
    asiChoices: preserve ? c.asiChoices : [],
    expertiseSkills: preserve ? c.expertiseSkills : [],
    metamagicOptions: preserve ? c.metamagicOptions : [],
    eldritchInvocations: preserve ? c.eldritchInvocations : [],
    pactBoon: preserve ? c.pactBoon : null,
    mysticArcanumPicks: preserve ? c.mysticArcanumPicks : {},
    spellMasteryPicks: preserve ? c.spellMasteryPicks : {},
    signatureSpellIds: preserve ? c.signatureSpellIds : [],
    selectedSkills: preserve ? c.selectedSkills : [],
    selectedEquipment: preserve ? c.selectedEquipment : [],
    spellcastingDetails: preserve ? c.spellcastingDetails : {},
  };
}

export function clearClassSelection(c: ExtendedCharacterCreation): ExtendedCharacterCreation {
  return {
    ...c,
    classId: null,
    className: null,
    subclassId: null,
    subclassName: null,
    hitDie: 0,
    hpAtLevel1: 0,
    hpPerLevelAverage: 0,
    hasSpellcasting: false,
    spellcastingKind: null,
    spellcastingAbility: null,
    savingThrows: [],
    armorProficiencies: [],
    weaponProficiencies: [],
    toolProficiencies: [],
    skillOptions: [],
    skillChooseCount: 0,
    classFeatures: [],
    startingEquipmentSlots: [],
    classProgressionResources: {},
    classBonusLanguageCount: 0,
    classSpellSlots: [],
    classResistances: [],
    classDarkvisionRadius: 0,
    classHasBlindsight: false,
    classBlindsightRadius: 0,
    bonusLanguageCount: (c.bonusLanguageCount || 0) - (c.classBonusLanguageCount || 0),
    requiredExoticLanguageCount: 0,
    requiredBaseLanguageCount: 0,
    secondaryClasses: [],
    classChoiceAnswers: {},
    asiBonuses: {},
    selectedFeatId: null,
    selectedFeatIds: [],
    asiChoices: [],
    expertiseSkills: [],
    metamagicOptions: [],
    eldritchInvocations: [],
    pactBoon: null,
    mysticArcanumPicks: {},
    spellMasteryPicks: {},
    signatureSpellIds: [],
    selectedSkills: [],
    selectedEquipment: [],
    spellcastingDetails: {},
  };
}

export function addSecondaryClassSelection(
  c: ExtendedCharacterCreation,
  selection: SecondaryClassSelection,
): ExtendedCharacterCreation {
  const existing = c.secondaryClasses ?? [];
  if (c.classId === selection.classId) return c;
  if (existing.some((sc) => sc.classId === selection.classId)) return c;
  return { ...c, secondaryClasses: [...existing, selection] };
}

export function removeSecondaryClassSelection(
  c: ExtendedCharacterCreation,
  index: number,
): ExtendedCharacterCreation {
  const list = [...(c.secondaryClasses ?? [])];
  if (!list[index]) return c;
  list.splice(index, 1);
  return { ...c, secondaryClasses: list };
}

export function applyClassProgressionChoices(
  c: ExtendedCharacterCreation,
  payload: {
    classChoiceAnswers: Record<string, string[]>;
    metamagicOptions?: string[];
    eldritchInvocations?: string[];
    pactBoon?: string | null;
    extraFeatures?: FeatureInstance[];
  },
  stripOld: (features: FeatureInstance[], extras: FeatureInstance[]) => FeatureInstance[],
): ExtendedCharacterCreation {
  const extras = payload.extraFeatures ?? [];
  const withoutOld = stripOld(c.classFeatures ?? [], extras);
  return {
    ...c,
    classChoiceAnswers: payload.classChoiceAnswers,
    metamagicOptions: payload.metamagicOptions ?? c.metamagicOptions ?? [],
    eldritchInvocations: payload.eldritchInvocations ?? c.eldritchInvocations ?? [],
    pactBoon: payload.pactBoon !== undefined ? payload.pactBoon : c.pactBoon,
    classFeatures: [...withoutOld, ...extras],
  };
}
