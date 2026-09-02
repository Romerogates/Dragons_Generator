import {
  resolveFeatureUses,
  extractScalarResources,
  type FeatureUsesInput,
} from '../utils/feature-uses.util';
import { annotateAuraDesc } from '../utils/aura-range.util';
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
import { proficiencyBonusForLevel } from '../utils/character-progression.util';
import { Injectable, signal, computed, inject } from '@angular/core';
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
  type RacialSpellGrant,
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

function isConcreteStyleRef(id: string): boolean {
  if (!id) return false;
  if (id.includes('style-de-combat')) return false;
  return id.startsWith('style-') || id.startsWith('feat-style-');
}

@Injectable({ providedIn: 'root' })
export class CharacterBuilderService {
  private readonly dataService = inject(DataService);
  private readonly handoff = inject(CharacterHandoffService);
  readonly creation = signal<ExtendedCharacterCreation>(structuredClone(INITIAL_CREATION_STATE));
  readonly currentStep = signal<number>(1);
  private readonly editingRef = signal<CharacterBuildEditingRef | null>(null);

  constructor() {
    this.purgeLegacyDraftStorage();
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
    const base = c.baseAbilities;
    const bonuses = c.racialBonuses;
    const asi = c.asiBonuses ?? {};
    const clamp = (n: number) => Math.min(20, n);
    return {
      force: clamp(base.force + (bonuses.force ?? 0) + (asi.force ?? 0)),
      dexterite: clamp(base.dexterite + (bonuses.dexterite ?? 0) + (asi.dexterite ?? 0)),
      constitution: clamp(
        base.constitution + (bonuses.constitution ?? 0) + (asi.constitution ?? 0),
      ),
      intelligence: clamp(
        base.intelligence + (bonuses.intelligence ?? 0) + (asi.intelligence ?? 0),
      ),
      sagesse: clamp(base.sagesse + (bonuses.sagesse ?? 0) + (asi.sagesse ?? 0)),
      charisme: clamp(base.charisme + (bonuses.charisme ?? 0) + (asi.charisme ?? 0)),
    };
  });

  readonly abilityModifiers = computed<AbilityScores>(() => {
    const a = this.finalAbilities();
    return {
      force: getAbilityModifier(a.force),
      dexterite: getAbilityModifier(a.dexterite),
      constitution: getAbilityModifier(a.constitution),
      intelligence: getAbilityModifier(a.intelligence),
      sagesse: getAbilityModifier(a.sagesse),
      charisme: getAbilityModifier(a.charisme),
    };
  });

  readonly hitPointsMax = computed<number>(() => {
    const c = this.creation();
    const level = Math.min(20, Math.max(1, c.targetLevel || 1));
    const con = this.abilityModifiers().constitution;
    const hp1 = c.hpAtLevel1 > 0 ? c.hpAtLevel1 : c.hitDie || 8;
    const hpAvg =
      c.hpPerLevelAverage > 0 ? c.hpPerLevelAverage : Math.floor((c.hitDie || 8) / 2) + 1;
    let hp = hp1 + con + (level - 1) * (hpAvg + con);
    // Lignée draconique : +1 PV max par niveau d'ensorceleur
    const hasDraconic =
      c.subclassId === 'subcls-lignee-draconique' ||
      (c.classFeatures ?? []).some((f) => f.refId === 'feat-resistance-draconique');
    if (hasDraconic && c.classId === 'cls-ensorceleur') {
      hp += level;
    }
    return hp;
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
    const mods = this.abilityModifiers();
    const hasPerception =
      this.creation().selectedSkills.includes('skill-perception') ||
      this.creation().backgroundSkills.includes('skill-perception');
    return 10 + mods.sagesse + (hasPerception ? 2 : 0);
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

  /** Tous les sorts raciaux requis ont été choisis (étape Magie). */
  private racialSpellsComplete(c: CharacterCreation): boolean {
    const grants = c.racialSpellGrants ?? [];
    if (!grants.length) return true;
    const answers = c.speciesChoiceAnswers ?? {};
    return grants.every((g) => {
      const pick = answers[g.choiceId]?.[0];
      return !!pick && pick !== 'any_wizard_cantrip';
    });
  }

  isStepValid(step: number): boolean {
    const c = this.creation();

    switch (step) {
      case 1:
        return c.speciesId !== null;
      case 2:
        return c.civilizationId !== null;
      case 3:
        return c.backgroundId !== null;
      case 4:
        return c.classId !== null;
      case 5:
        return c.pointsRemaining >= 0;
      case 6:
        return true;
      case 7:
        return true;
      case 8:
        return c.languages.length > 0;
      case 9:
        if (this.needsMagicStep()) {
          if (!this.racialSpellsComplete(c)) return false;
          if (c.hasSpellcasting) {
            const details = c.spellcastingDetails as Record<string, unknown> | undefined;
            return !!details && Object.keys(details).length > 0;
          }
          const details = c.spellcastingDetails as { cantrips?: unknown[] } | undefined;
          return !!(details?.cantrips?.length);
        }
        return c.name.trim().length > 0;
      case 10:
        if (this.needsMagicStep()) return c.name.trim().length > 0;
        return true;
      case 11:
        return true;
      default:
        return false;
    }
  }

  setSpecies(selection: SpeciesSelection): void {
    this.creation.update((c) => {
      const cAny = c as any;
      const prevSpBonus = cAny._spBonusLang || 0;
      const newBonusTotal =
        (c.bonusLanguageCount || 0) - prevSpBonus + selection.bonusLanguageCount;

      const newState: any = {
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
        speciesChoiceAnswers: selection.choiceAnswers,
        speciesBonusSkillCount: selection.bonusSkillCount,
        speciesBonusToolCount: selection.bonusToolCount,
        racialSpellGrants: selection.racialSpellGrants,
        bonusLanguageCount: newBonusTotal,
        languages: [
          ...new Set([
            ...selection.languages.map((l) => this.normalizeLanguageName(l)),
            ...c.civilizationLanguages.map((l) => this.normalizeLanguageName(l)),
            ...c.backgroundLanguages.map((l) => this.normalizeLanguageName(l)),
          ]),
        ],
      };

      newState._spBonusLang = selection.bonusLanguageCount;
      return newState as ExtendedCharacterCreation;
    });
  }

  clearSpecies(): void {
    this.creation.update((c) => {
      const cAny = c as any;
      const prevSpBonus = cAny._spBonusLang || 0;

      const newState: any = {
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
        speciesChoiceAnswers: {},
        speciesBonusSkillCount: 0,
        speciesBonusToolCount: 0,
        racialSpellGrants: [],
        bonusLanguageCount: (c.bonusLanguageCount || 0) - prevSpBonus,
        languages: [
          ...new Set([
            ...c.civilizationLanguages.map((l) => this.normalizeLanguageName(l)),
            ...c.backgroundLanguages.map((l) => this.normalizeLanguageName(l)),
          ]),
        ],
      };

      newState._spBonusLang = 0;
      return newState as ExtendedCharacterCreation;
    });
  }

  setCivilization(selection: CivilizationSelection): void {
    this.creation.update((c) => ({
      ...c,
      civilizationId: selection.civilizationId,
      civilizationName: selection.civilizationName,
      civilizationLanguages: selection.languages,
      civilizationWritingSystems: selection.writingSystems,
      languages: [
        ...new Set([
          ...c.speciesLanguages.map((l) => this.normalizeLanguageName(l)),
          ...selection.languages.map((l) => this.normalizeLanguageName(l)),
          ...c.backgroundLanguages.map((l) => this.normalizeLanguageName(l)),
        ]),
      ],
    }));
  }

  clearCivilization(): void {
    this.creation.update((c) => ({
      ...c,
      civilizationId: null,
      civilizationName: null,
      civilizationLanguages: [],
      civilizationWritingSystems: [],
      languages: [
        ...new Set([
          ...c.speciesLanguages.map((l) => this.normalizeLanguageName(l)),
          ...c.backgroundLanguages.map((l) => this.normalizeLanguageName(l)),
        ]),
      ],
    }));
  }

  setBackground(selection: BackgroundSelection): void {
    this.creation.update((c) => {
      const cAny = c as any;
      const prevBgBonus = cAny._bgBonusLang || 0;
      const newBonusTotal =
        (c.bonusLanguageCount || 0) - prevBgBonus + selection.bonusLanguageCount;

      const newState: ExtendedCharacterCreation = {
        ...c,
        backgroundId: selection.backgroundId,
        backgroundName: selection.backgroundName,
        backgroundPreset: selection.backgroundPreset,
        backgroundProficiencies: selection.proficiencies ?? null,
        backgroundSkills: (selection.skills ?? []).map((s) =>
          s.startsWith('skill-') || s.startsWith('ski-')
            ? s.startsWith('ski-')
              ? `skill-${s.slice(4)}`
              : s
            : s,
        ),
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
        languages: [
          ...new Set([
            ...c.speciesLanguages.map((l) => this.normalizeLanguageName(l)),
            ...c.civilizationLanguages.map((l) => this.normalizeLanguageName(l)),
          ]),
        ],
      };

      (newState as any)._bgBonusLang = selection.bonusLanguageCount;
      return newState;
    });
  }

  clearBackground(): void {
    this.creation.update((c) => {
      const cAny = c as any;
      const prevBgBonus = cAny._bgBonusLang || 0;

      const newState: ExtendedCharacterCreation = {
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
        languages: [...new Set([...c.speciesLanguages, ...c.civilizationLanguages])],
      };

      (newState as any)._bgBonusLang = 0;
      return newState;
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
        const features: FeatureInstance[] = [];
        const progression = (cls.data?.progression ?? []) as {
          level: number;
          features?: string[];
          resources?: Record<string, unknown>;
        }[];
        const details = (cls.data?.features_details ?? []) as (FeatureUsesInput & {
          id: string;
          name: string;
          desc: string;
          level?: number;
        })[];
        const profBonus = proficiencyBonusForLevel(targetLevel);

        for (const prog of progression) {
          if (prog.level < 1 || prog.level > targetLevel) continue;
          for (const id of prog.features ?? []) {
            const feat = details.find((f) => f.id === id);
            if (!feat || features.some((f) => f.refId === feat.id)) continue;
            features.push({
              refId: feat.id,
              name: feat.name,
              desc: annotateAuraDesc(feat as any, targetLevel),
              source: 'class',
              sourceDetail: `${cls.name} ${prog.level}`,
              level: prog.level,
              uses: resolveFeatureUses(feat, cls, targetLevel, profBonus),
            });
          }
        }

        const subId = c.subclassId;
        const options = (cls.data as any)?.subclasses?.options ?? [];
        const sub = subId ? options.find((o: any) => o.id === subId) : null;
        if (sub?.features) {
          for (const feat of sub.features as (FeatureUsesInput & {
            id: string;
            name: string;
            desc: string;
            level: number;
          })[]) {
            if ((feat.level ?? 1) > targetLevel) continue;
            if (features.some((f) => f.refId === feat.id)) continue;
            features.push({
              refId: feat.id,
              name: feat.name,
              desc: annotateAuraDesc(feat as any, targetLevel),
              source: 'subclass',
              sourceDetail: `${sub.name} ${feat.level}`,
              level: feat.level,
              uses: resolveFeatureUses(feat, cls, targetLevel, profBonus),
            });
          }
        }

        // Conserve les styles de combat déjà présents (ids style-* ou feat-style-*)
        const combatStyles = (c.classFeatures ?? []).filter((f) =>
          isConcreteStyleRef(f.refId ?? ''),
        );

        // Paladin / Rôdeur : débloque l'incantation à partir du niv. 2
        let hasSpellcasting = c.hasSpellcasting;
        let spellcastingKind = c.spellcastingKind;
        let spellcastingAbility = c.spellcastingAbility;
        if (c.classId === 'cls-paladin' && targetLevel >= 2) {
          hasSpellcasting = true;
          spellcastingKind = 'paladin';
          spellcastingAbility = 'Charisme';
        } else if (c.classId === 'cls-rodeur' && targetLevel >= 2) {
          hasSpellcasting = true;
          spellcastingKind = 'ranger';
          spellcastingAbility = 'Sagesse';
        } else if (
          (c.classId === 'cls-paladin' || c.classId === 'cls-rodeur') &&
          targetLevel < 2
        ) {
          hasSpellcasting = false;
          spellcastingKind = null;
          spellcastingAbility = null;
        }

        const progAtLevel = progression.find((p) => p.level === targetLevel);
        const classProgressionResources = extractScalarResources(progAtLevel?.resources);

        this.creation.update((cur) => ({
          ...cur,
          classFeatures: [...features, ...combatStyles],
          classProgressionResources,
          hasSpellcasting,
          spellcastingKind,
          spellcastingAbility,
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
      bonusLanguageCount: (c.bonusLanguageCount || 0) - prevClassLang + newClassLang,
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
      weaponProficiencies: [...new Set([...(c.weaponProficiencies ?? []), ...extraWeapons])],
      toolProficiencies: [...new Set([...(c.toolProficiencies ?? []), ...extraTools])],
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
      const stripPrefixes = [
        'invoc-',
        'meta-',
        'pact-boon-',
        'ennemi-',
        'terrain-',
        'dragon-',
        'feat-astuce-',
        'feat-conquete-',
      ];
      const withoutOld = (c.classFeatures ?? []).filter((f) => {
        const id = f.refId ?? '';
        if (extras.some((e) => e.refId === id)) return false;
        return !stripPrefixes.some((p) => id.startsWith(p));
      });
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
  setAsiChoices(slots: AsiChoiceSlot[]): void {
    const bonuses: Partial<AbilityScores> = {};
    const featIds: string[] = [];
    for (const slot of slots) {
      if (slot.mode === 'feat' && slot.featId) {
        featIds.push(slot.featId);
        continue;
      }
      if (slot.mode === 'plus2' && slot.primary) {
        bonuses[slot.primary] = (bonuses[slot.primary] ?? 0) + 2;
      } else if (slot.mode === 'plus1plus1' && slot.primary && slot.secondary) {
        bonuses[slot.primary] = (bonuses[slot.primary] ?? 0) + 1;
        bonuses[slot.secondary] = (bonuses[slot.secondary] ?? 0) + 1;
      }
    }
    // Cap soft à 20 côté affichage final (apply dans finalAbilities si besoin)
    this.creation.update((c) => ({
      ...c,
      asiChoices: slots.map((s) => ({ ...s })),
      asiBonuses: bonuses,
      selectedFeatIds: featIds,
      selectedFeatId: featIds[0] ?? null,
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
      bonusLanguageCount: (c.bonusLanguageCount || 0) - (c.classBonusLanguageCount || 0),
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
    this.creation.update(
      (c) =>
        ({
          ...c,
          selectedSkills: classSkills,
          backgroundSkills: bgSkills,
          backgroundTools: bgTools,
          toolEquipmentSlots: toolSlots,
        }) as ExtendedCharacterCreation,
    );
  }

  setAbilityScore(key: AbilityKey, value: number): void {
    if (value < MIN_ABILITY_SCORE || value > MAX_ABILITY_SCORE) return;
    const c = this.creation();
    const currentCost = ABILITY_POINT_COSTS[c.baseAbilities[key]] ?? 0;
    const newCost = ABILITY_POINT_COSTS[value] ?? 0;
    if (c.pointsRemaining + currentCost - newCost < 0) return;
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
    this.creation.update((c) => {
      if (c.selectedSkills.includes(skill)) {
        return { ...c, selectedSkills: c.selectedSkills.filter((s) => s !== skill) };
      }
      if (c.selectedSkills.length < c.skillChooseCount) {
        return { ...c, selectedSkills: [...c.selectedSkills, skill] };
      }
      return c;
    });
  }

  clearSkills(): void {
    this.creation.update((c) => ({ ...c, selectedSkills: [] }));
  }

  setEquipment(items: EquipmentInstance[]): void {
    this.creation.update((c) => ({ ...c, selectedEquipment: items }));
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
    if (step >= 1 && step <= this.totalSteps()) {
      this.currentStep.set(step);
    }
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
    const { creation, editing } = mapCharacterToEditState(savedCharacter);
    this.editingRef.set(editing);
    this.creation.set(creation);
    this.currentStep.set(this.summaryStep());
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

  private purgeLegacyDraftStorage(): void {
    this.clearStorage();
    localStorage.removeItem('dragon_character_builder_v5');
    localStorage.removeItem('dragon_character_builder_v4');
  }

  private clearStorage(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  private normalizeLanguageName(lang: string): string {
    // Si c'est un ID (commence par "lg-"), on le convertit en nom lisible
    if (lang.startsWith('lg-')) {
      return lang
        .replace(/^lg-/, '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return lang;
  }
}
