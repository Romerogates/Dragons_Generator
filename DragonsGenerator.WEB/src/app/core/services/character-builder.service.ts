import {
  buildCharacterFromCreation,
  type CharacterBuildEditingRef,
} from '../utils/character-build.util';
import {
  mapCharacterToEditState,
  validateCharacterForEdit,
} from '../utils/character-edit.mapper';
import {
  computeCharacterArmorClass,
} from '../utils/character-combat.util';
import {
  aggregateAsiChoices,
  canAffordAbilityScore,
  computeAbilityModifiersFromScores,
  computeFinalAbilities,
  computeHitPointsMax,
  computePassivePerception,
} from '../utils/character-abilities.util';
import {
  buildClassFeaturesForLevel,
} from '../utils/character-class-features.util';
import { mergeCreationLanguages } from '../utils/character-languages.util';
import {
  mergeToolProficiencies,
  mergeWeaponProficiencies,
  normalizeBackgroundSkillId,
  stripProgressionChoiceFeatures,
  toggleSkillSelection,
} from '../utils/character-proficiencies.util';
import { proficiencyBonusForLevel } from '../utils/character-progression.util';
import type { RawFeatData } from '../utils/feat-benefits.util';
import type { Spell } from '../models/Spells/spell';
import { isWizardStepValid } from '../utils/character-wizard-validation.util';
import { Injectable, signal, computed, inject, effect } from '@angular/core';
import { forkJoin } from 'rxjs';
import { DataService } from './data.service';
import { CharacterHandoffService } from './character-handoff.service';
import {
  Character,
  CharacterCreation,
  AbilityKey,
  AbilityScores,
  AsiChoiceSlot,
  Size,
  FeatureInstance,
  EquipmentInstance,
  EquipmentSlot,
  Currency,
  ABILITY_POINT_COSTS,
  STARTING_POINTS,
  DEFAULT_ABILITY_SCORE,
  MIN_ABILITY_SCORE,
  MAX_ABILITY_SCORE,
  getAbilityModifier,
  formatModifier,
} from '../models/Character/character';
import {
  INITIAL_CREATION_STATE,
  type BackgroundSelection,
  type CivilizationSelection,
  type ClassSelection,
  type ExtendedCharacterCreation,
  type IdentitySelection,
  type SpeciesSelection,
} from '../models/Character/character-builder.types';

export type {
  BackgroundSelection,
  CivilizationSelection,
  ClassSelection,
  ExtendedCharacterCreation,
  IdentitySelection,
  RacialSpellGrant,
  SpeciesSelection,
} from '../models/Character/character-builder.types';

const STORAGE_KEY = 'dragon_character_builder_v6';

export { proficiencyBonusForLevel } from '../utils/character-progression.util';

@Injectable({ providedIn: 'root' })
export class CharacterBuilderService {
  private readonly dataService = inject(DataService);
  private readonly handoff = inject(CharacterHandoffService);
  readonly creation = signal<ExtendedCharacterCreation>(structuredClone(INITIAL_CREATION_STATE));
  readonly currentStep = signal<number>(1);
  private readonly editingRef = signal<CharacterBuildEditingRef | null>(null);

  constructor() {
    this.purgeLegacyDraftKeys();
    this.restoreDraftFromStorage();
    effect(() => {
      const creation = this.creation();
      const step = this.currentStep();
      if (this.editingRef()) return;
      this.persistDraft(creation, step);
    });
  }

  readonly steps = computed(() => {
    const base = [
      { number: 1, title: 'Espèce', icon: '🧬' },
      { number: 2, title: 'Civilisation', icon: '🏰' },
      { number: 3, title: 'Historique', icon: '📖' },
      { number: 4, title: 'Classe', icon: '⚔️' },
      { number: 5, title: 'Caractéristiques', icon: '📊' },
      { number: 6, title: 'Savoirs & Maîtrises', icon: '🎯' },
      { number: 7, title: 'Équipement', icon: '🎒' },
      { number: 8, title: 'Langues', icon: '🗣️' },
    ];

    if (this.needsMagicStep()) {
      base.push({ number: 9, title: 'Magie', icon: '✨' });
      base.push({ number: 10, title: 'Identité', icon: '📜' });
      base.push({ number: 11, title: 'Récapitulatif', icon: '✅' });
    } else {
      base.push({ number: 9, title: 'Identité', icon: '📜' });
      base.push({ number: 10, title: 'Récapitulatif', icon: '✅' });
    }

    return base;
  });

  /** Étape Magie si la classe incante ou si l'espèce accorde un sort racial. */
  readonly needsMagicStep = computed(
    () =>
      this.creation().hasSpellcasting || (this.creation().racialSpellGrants?.length ?? 0) > 0,
  );

  readonly totalSteps = computed(() => this.steps().length);
  readonly summaryStep = computed(() => this.totalSteps());

  /** Étape « Classe » (fixe dans le wizard). */
  readonly classStepNumber = 4;

  /**
   * Niveau verrouillé une fois l'étape Classe dépassée :
   * ASI, expertise, sorts, ressources dépendent du niveau déjà choisi.
   * Revenir à Classe (≤ 4) le déverrouille.
   */
  readonly isLevelLocked = computed(() => this.currentStep() > this.classStepNumber);

  readonly finalAbilities = computed<AbilityScores>(() => {
    const c = this.creation();
    return computeFinalAbilities(c.baseAbilities, c.racialBonuses, c.asiBonuses ?? {});
  });

  readonly abilityModifiers = computed<AbilityScores>(() =>
    computeAbilityModifiersFromScores(this.finalAbilities()),
  );

  readonly hitPointsMax = computed<number>(() => {
    const c = this.creation();
    return computeHitPointsMax({
      targetLevel: c.targetLevel || 1,
      hpAtLevel1: c.hpAtLevel1,
      hpPerLevelAverage: c.hpPerLevelAverage,
      hitDie: c.hitDie,
      constitutionMod: this.abilityModifiers().constitution,
      classId: c.classId,
      subclassId: c.subclassId,
      subspeciesId: c.subspeciesId,
      classFeatures: c.classFeatures ?? [],
    });
  });

  readonly proficiencyBonus = computed<number>(() =>
    proficiencyBonusForLevel(this.creation().targetLevel || 1),
  );

  readonly targetLevel = computed(() => Math.min(20, Math.max(1, this.creation().targetLevel || 1)));

  readonly woundThreshold = computed<number>(() => {
    return Math.ceil(this.hitPointsMax() / 2);
  });

  readonly baseArmorClass = computed<number>(() => {
    const c = this.creation();
    const allEquipment = [...c.selectedEquipment, ...(c.backgroundEquipment ?? [])];
    return computeCharacterArmorClass(allEquipment, this.abilityModifiers(), {
      classId: c.classId,
      subclassId: c.subclassId,
      classFeatures: c.classFeatures,
    });
  });

  readonly initiative = computed<number>(() => {
    return this.abilityModifiers().dexterite;
  });

  readonly passivePerception = computed<number>(() => {
    const c = this.creation();
    const hasPerception =
      c.selectedSkills.includes('skill-perception') ||
      c.backgroundSkills.includes('skill-perception');
    return computePassivePerception(
      this.abilityModifiers().sagesse,
      hasPerception,
      this.proficiencyBonus(),
    );
  });

  readonly isCurrentStepValid = computed<boolean>(() => {
    return this.isStepValid(this.currentStep());
  });

  readonly hasPendingDraft = computed<boolean>(() => {
    return this.creation().speciesId !== null;
  });

  readonly draftSummary = computed<string>(() => {
    const c = this.creation();
    const parts: string[] = [];
    if (c.name) parts.push(c.name);
    if (c.speciesName) parts.push(c.speciesName);
    if (c.backgroundName) parts.push(c.backgroundName);
    if (c.className) parts.push(c.className);
    return parts.length > 0 ? parts.join(' · ') : 'Brouillon en cours';
  });

  isStepValid(step: number): boolean {
    return isWizardStepValid(step, this.creation(), {
      needsMagicStep: this.needsMagicStep(),
    });
  }

  setSpecies(selection: SpeciesSelection): void {
    this.creation.update((c) => {
      const prevSpBonus = c.speciesBonusLangApplied ?? 0;
      const newBonusTotal =
        (c.bonusLanguageCount || 0) - prevSpBonus + selection.bonusLanguageCount;

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
        languages: mergeCreationLanguages(
          selection.languages,
          c.civilizationLanguages,
          c.backgroundLanguages,
        ),
      };
    });
  }

  clearSpecies(): void {
    this.creation.update((c) => {
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
    });
  }

  setCivilization(selection: CivilizationSelection): void {
    this.creation.update((c) => ({
      ...c,
      civilizationId: selection.civilizationId,
      civilizationName: selection.civilizationName,
      civilizationLanguages: selection.languages,
      civilizationWritingSystems: selection.writingSystems,
      languages: mergeCreationLanguages(
        c.speciesLanguages,
        selection.languages,
        c.backgroundLanguages,
      ),
    }));
  }

  clearCivilization(): void {
    this.creation.update((c) => ({
      ...c,
      civilizationId: null,
      civilizationName: null,
      civilizationLanguages: [],
      civilizationWritingSystems: [],
      languages: mergeCreationLanguages(c.speciesLanguages, c.backgroundLanguages),
    }));
  }

  setBackground(selection: BackgroundSelection): void {
    this.creation.update((c) => {
      const prevBgBonus = c.backgroundBonusLangApplied ?? 0;
      const newBonusTotal =
        (c.bonusLanguageCount || 0) - prevBgBonus + selection.bonusLanguageCount;

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
    });
  }

  clearBackground(): void {
    this.creation.update((c) => {
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
    });
  }

  setTargetLevel(level: number): void {
    if (this.isLevelLocked()) return;
    const targetLevel = Math.min(20, Math.max(1, Math.floor(Number(level)) || 1));
    this.creation.update((c) => ({
      ...c,
      targetLevel,
      classFeatures: (c.classFeatures ?? []).filter((f) => (f.level ?? 1) <= targetLevel),
    }));
    this.refreshClassFeaturesForLevel(targetLevel);
  }

  /**
   * Recharge les aptitudes de classe/sous-classe pour le niveau cible
   * (utile quand on change le niveau hors de l'étape Classe).
   */
  private refreshClassFeaturesForLevel(targetLevel: number): void {
    const c = this.creation();
    if (!c.classId) return;

    this.dataService.getClassById(c.classId).subscribe({
      next: (cls) => {
        const result = buildClassFeaturesForLevel(
          cls,
          {
            classId: c.classId!,
            subclassId: c.subclassId,
            hasSpellcasting: c.hasSpellcasting,
            spellcastingKind: c.spellcastingKind,
            spellcastingAbility: c.spellcastingAbility,
            existingClassFeatures: c.classFeatures ?? [],
          },
          targetLevel,
        );

        this.creation.update((cur) => ({
          ...cur,
          ...result,
        }));
      },
      error: () => {
        /* silencieux : le filtre local suffit en fallback */
      },
    });
  }

  setClass(selection: ClassSelection, opts?: { preserveProgress?: boolean }): void {
    const preserve = opts?.preserveProgress === true;
    this.creation.update((c) => {
      const prevClassLang = c.classBonusLanguageCount ?? 0;
      const newClassLang = selection.classBonusLanguageCount ?? 0;
      return {
      ...c,
      classId: selection.classId,
      className: selection.className,
      subclassId: selection.subclassId ?? null,
      subclassName: selection.subclassName ?? null,
      hitDie: selection.hitDie,
      hpAtLevel1:
        selection.hpAtLevel1 && selection.hpAtLevel1 > 0
          ? selection.hpAtLevel1
          : selection.hitDie,
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
      startingEquipmentSlots: selection.startingEquipmentSlots,
      classProgressionResources: selection.classProgressionResources ?? {},
      classBonusLanguageCount: newClassLang,
      classSpellSlots: selection.classSpellSlots ?? [],
      classResistances: selection.classResistances ?? [],
      classDarkvisionRadius: selection.classDarkvisionRadius ?? 0,
      classHasBlindsight: selection.classHasBlindsight ?? false,
      classBlindsightRadius: selection.classBlindsightRadius ?? 0,
      bonusLanguageCount: (c.bonusLanguageCount || 0) - prevClassLang + newClassLang,
      requiredExoticLanguageCount: selection.classRequiredExoticLanguageCount ?? 0,
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
    });
  }

  /** Fusionne les maîtrises d'armes/outils choisies à l'étape Savoirs. */
  mergeClassProficiencies(
    extraWeapons: string[],
    extraTools: string[],
    choiceAnswers: Record<string, string[]>,
  ): void {
    this.creation.update((c) => ({
      ...c,
      weaponProficiencies: mergeWeaponProficiencies(c.weaponProficiencies ?? [], extraWeapons),
      toolProficiencies: mergeToolProficiencies(c.toolProficiencies ?? [], extraTools),
      classChoiceAnswers: { ...c.classChoiceAnswers, ...choiceAnswers },
    }));
  }

  setClassProgressionChoices(payload: {
    classChoiceAnswers: Record<string, string[]>;
    metamagicOptions?: string[];
    eldritchInvocations?: string[];
    pactBoon?: string | null;
    extraFeatures?: FeatureInstance[];
  }): void {
    this.creation.update((c) => {
      const extras = payload.extraFeatures ?? [];
      const withoutOld = stripProgressionChoiceFeatures(c.classFeatures ?? [], extras);
      return {
        ...c,
        classChoiceAnswers: payload.classChoiceAnswers,
        metamagicOptions: payload.metamagicOptions ?? c.metamagicOptions ?? [],
        eldritchInvocations: payload.eldritchInvocations ?? c.eldritchInvocations ?? [],
        pactBoon: payload.pactBoon !== undefined ? payload.pactBoon : c.pactBoon,
        classFeatures: [...withoutOld, ...extras],
      };
    });
  }

  setAsiChoice(bonuses: Partial<AbilityScores>, featId: string | null = null): void {
    this.creation.update((c) => ({
      ...c,
      asiBonuses: bonuses,
      selectedFeatId: featId,
      selectedFeatIds: featId ? [featId] : [],
      asiChoices: [],
    }));
  }

  /** Applique N slots ASI (niveaux 4–20) : somme des bonus + liste des dons. */
  setAsiChoices(
    slots: AsiChoiceSlot[],
    ctx?: {
      feats?: Map<string, RawFeatData>;
      spellcastingAbility?: AbilityKey | null;
      featDetailsById?: Record<string, { name: string; desc: string }>;
      spells?: Map<string, Spell>;
    },
  ): void {
    const {
      bonuses,
      featIds,
      featDarkvisionRadius,
      featBonusArmor,
      featBonusTools,
      featResistances,
      talentBonusSkills,
      talentExpertiseSkills,
      talentBonusWeapons,
      talentSavingThrows,
      talentBonusLanguageCount,
      talentRequiredExoticLanguages,
      talentBonusCantrips,
    } = aggregateAsiChoices(slots, ctx);
    this.creation.update((c) => ({
      ...c,
      asiChoices: slots.map((s) => ({ ...s })),
      asiBonuses: bonuses,
      selectedFeatIds: featIds,
      selectedFeatId: featIds[0] ?? null,
      featDarkvisionRadius,
      featBonusArmor,
      featBonusTools,
      featResistances,
      featDetailsById: ctx?.featDetailsById ?? c.featDetailsById,
      talentBonusSkills,
      talentExpertiseSkills,
      talentBonusWeapons,
      talentSavingThrows,
      talentBonusCantrips,
      // Delta additif : on retire l'ancienne contribution du Talent avant d'appliquer la nouvelle,
      // pour ne jamais compter deux fois si le joueur modifie ses dépenses (même pattern que les
      // langues bonus espèce/historique/classe ci-dessus).
      bonusLanguageCount:
        (c.bonusLanguageCount || 0) - (c.talentBonusLangApplied || 0) + talentBonusLanguageCount,
      requiredExoticLanguageCount:
        (c.requiredExoticLanguageCount || 0) -
        (c.talentExoticLangApplied || 0) +
        talentRequiredExoticLanguages,
      talentBonusLangApplied: talentBonusLanguageCount,
      talentExoticLangApplied: talentRequiredExoticLanguages,
    }));
  }

  setMysticArcanumPicks(picks: Record<string, string>): void {
    this.creation.update((c) => ({
      ...c,
      mysticArcanumPicks: { ...picks },
    }));
  }

  setExpertiseSkills(skills: string[]): void {
    this.creation.update((c) => ({
      ...c,
      expertiseSkills: [...skills],
    }));
  }

  clearClass(): void {
    this.creation.update((c) => ({
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
    }));
  }

  setProficiencies(
    classSkills: string[],
    bgSkills: string[],
    bgTools: string[],
    toolSlots: EquipmentSlot[],
  ): void {
    this.creation.update((c) => ({
      ...c,
      selectedSkills: classSkills,
      backgroundSkills: bgSkills,
      backgroundTools: bgTools,
      toolEquipmentSlots: toolSlots,
    }));
  }

  setAbilityScore(key: AbilityKey, value: number): void {
    if (value < MIN_ABILITY_SCORE || value > MAX_ABILITY_SCORE) return;
    const c = this.creation();
    const current = c.baseAbilities[key];
    if (!canAffordAbilityScore(current, value, c.pointsRemaining)) return;
    const currentCost = ABILITY_POINT_COSTS[current] ?? 0;
    const newCost = ABILITY_POINT_COSTS[value] ?? 0;
    this.creation.update((state) => ({
      ...state,
      baseAbilities: { ...state.baseAbilities, [key]: value },
      pointsRemaining: state.pointsRemaining + currentCost - newCost,
    }));
  }

  incrementAbility(key: AbilityKey): void {
    const current = this.creation().baseAbilities[key];
    if (current < MAX_ABILITY_SCORE) this.setAbilityScore(key, current + 1);
  }

  decrementAbility(key: AbilityKey): void {
    const current = this.creation().baseAbilities[key];
    if (current > MIN_ABILITY_SCORE) this.setAbilityScore(key, current - 1);
  }

  resetAbilities(): void {
    this.creation.update((c) => ({
      ...c,
      baseAbilities: {
        force: DEFAULT_ABILITY_SCORE,
        dexterite: DEFAULT_ABILITY_SCORE,
        constitution: DEFAULT_ABILITY_SCORE,
        intelligence: DEFAULT_ABILITY_SCORE,
        sagesse: DEFAULT_ABILITY_SCORE,
        charisme: DEFAULT_ABILITY_SCORE,
      },
      pointsRemaining: STARTING_POINTS,
    }));
  }

  toggleSkill(skill: string): void {
    this.creation.update((c) => ({
      ...c,
      selectedSkills: toggleSkillSelection(c.selectedSkills, skill, c.skillChooseCount),
    }));
  }

  clearSkills(): void {
    this.creation.update((c) => ({ ...c, selectedSkills: [] }));
  }

  setEquipment(
    items: EquipmentInstance[],
    wizardPicks?: { alt: Record<string, number>; category: Record<string, string[]> } | null,
  ): void {
    this.creation.update((c) => ({
      ...c,
      selectedEquipment: items,
      equipmentWizardPicks: wizardPicks ?? c.equipmentWizardPicks ?? null,
    }));
  }

  addEquipmentItem(item: EquipmentInstance): void {
    this.creation.update((c) => ({
      ...c,
      selectedEquipment: [...c.selectedEquipment, item],
    }));
  }

  removeEquipmentItem(instanceId: string): void {
    this.creation.update((c) => ({
      ...c,
      selectedEquipment: c.selectedEquipment.filter((e) => e.instanceId !== instanceId),
    }));
  }

  setCurrency(currency: Partial<Currency>): void {
    this.creation.update((c) => ({
      ...c,
      currency: { ...c.currency, ...currency },
    }));
  }

  setLanguages(languages: string[]): void {
    this.creation.update((c) => ({ ...c, languages }));
  }

  addLanguage(language: string): void {
    this.creation.update((c) => ({
      ...c,
      languages: [...new Set([...c.languages, language])],
    }));
  }

  removeLanguage(language: string): void {
    this.creation.update((c) => ({
      ...c,
      languages: c.languages.filter((l) => l !== language),
    }));
  }

  setIdentity(identity: IdentitySelection): void {
    this.creation.update((c) => ({ ...c, ...identity }));
  }

  setSpellcastingDetails(details: Record<string, unknown>): void {
    this.creation.update((c) => ({ ...c, spellcastingDetails: details }));
  }

  nextStep(): void {
    const total = this.totalSteps();
    if (this.currentStep() < total && this.isCurrentStepValid()) {
      this.currentStep.update((s) => s + 1);
    }
  }

  previousStep(): void {
    if (this.currentStep() > 1) {
      this.currentStep.update((s) => s - 1);
    }
  }

  goToStep(step: number): void {
    const total = this.totalSteps();
    if (step < 1 || step > total) return;
    if (step > this.currentStep()) {
      for (let s = this.currentStep(); s < step; s++) {
        if (!this.isStepValid(s)) return;
      }
    }
    this.currentStep.set(step);
  }

  get isEditMode(): boolean {
    return this.editingRef() !== null;
  }

  get editingCharacterId(): string | null {
    return this.editingRef()?.id ?? null;
  }

  get editingCharacterCreatedAt(): string | null {
    return this.editingRef()?.createdAt ?? null;
  }

  loadForEdit(savedCharacter: Character): void {
    const errors = validateCharacterForEdit(savedCharacter);
    if (errors.length) {
      throw new Error(`Personnage invalide pour édition : ${errors.join(', ')}`);
    }
    // Chargement initial sans les catalogues dons/sorts : les bonus déjà fusionnés dans le
    // personnage sauvegardé restent corrects, seuls les caches `talentBonus*`/`featBonus*`
    // attendent le contexte ci-dessous (remplacé dès qu'il arrive, cf. plus bas).
    const { creation, editing } = mapCharacterToEditState(savedCharacter);
    this.editingRef.set(editing);
    this.creation.set(creation);
    this.currentStep.set(this.summaryStep());

    // On recharge ensuite avec le contexte complet (dons + sorts) pour recalculer fidèlement
    // les bonus dérivés des dons (don "Talent" à 4 points, darkvision, résistances…), sans
    // attendre que le joueur retraverse l'étape Caractéristiques.
    if (savedCharacter.asiChoices?.length) {
      forkJoin({
        feats: this.dataService.getFeats(),
        spells: this.dataService.getSpells(),
      }).subscribe({
        next: ({ feats, spells }) => {
          const featsById = new Map<string, RawFeatData>(
            (feats ?? []).map((f) => [f.id, (f.data ?? {}) as RawFeatData]),
          );
          const spellsById = new Map<string, Spell>((spells ?? []).map((s) => [s.id, s]));
          const { creation: refined } = mapCharacterToEditState(savedCharacter, {
            feats: featsById,
            spells: spellsById,
          });
          // Ne réapplique que si on est toujours en train d'éditer ce même personnage (l'utilisateur
          // n'a pas déjà réinitialisé ou changé de page pendant le chargement asynchrone).
          if (this.editingRef()?.id === editing.id) {
            this.creation.set(refined);
          }
        },
        error: () => {
          // Silencieux : le personnage reste éditable avec les bonus déjà fusionnés au moment
          // de la sauvegarde, seuls les caches internes ne sont pas rafraîchis.
        },
      });
    }
  }

  checkForEditMode(): void {
    const character = this.handoff.consumeEdit();
    if (!character) return;
    try {
      this.loadForEdit(character);
    } catch (error) {
      console.error('Erreur lors du chargement du personnage à éditer:', error);
    }
  }

  reset(): void {
    this.creation.set(structuredClone(INITIAL_CREATION_STATE));
    this.currentStep.set(1);
    this.editingRef.set(null);
    this.clearStorage();
  }

  build(): Character {
    return buildCharacterFromCreation({
      creation: this.creation(),
      abilities: this.finalAbilities(),
      modifiers: this.abilityModifiers(),
      hpMax: this.hitPointsMax(),
      proficiencyBonus: this.proficiencyBonus(),
      targetLevel: this.targetLevel(),
      passivePerception: this.passivePerception(),
      editing: this.editingRef(),
    });
  }

  getModifier(score: number): number {
    return getAbilityModifier(score);
  }

  formatMod(score: number): string {
    return formatModifier(getAbilityModifier(score));
  }

  private purgeLegacyDraftKeys(): void {
    localStorage.removeItem('dragon_character_builder_v5');
    localStorage.removeItem('dragon_character_builder_v4');
  }

  private restoreDraftFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        creation?: ExtendedCharacterCreation;
        currentStep?: number;
      };
      if (!parsed?.creation?.speciesId) {
        this.clearStorage();
        return;
      }
      this.creation.set({
        ...structuredClone(INITIAL_CREATION_STATE),
        ...parsed.creation,
      });
      const step = Number(parsed.currentStep) || 1;
      this.currentStep.set(Math.max(1, Math.min(step, 20)));
    } catch {
      this.clearStorage();
    }
  }

  private persistDraft(creation: ExtendedCharacterCreation, step: number): void {
    try {
      if (!creation.speciesId) {
        this.clearStorage();
        return;
      }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          creation,
          currentStep: step,
          savedAt: Date.now(),
        }),
      );
    } catch {
      /* quota / private mode */
    }
  }

  private clearStorage(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}
