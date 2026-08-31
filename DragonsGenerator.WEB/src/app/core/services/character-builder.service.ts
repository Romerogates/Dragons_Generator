import {
  resolveFeatureUses,
  extractScalarResources,
  type FeatureUsesInput,
} from '../utils/feature-uses.util';
import { invocationLabel, pactBoonLabel } from '../data/warlock-invocations.data';
import { metamagicLabel } from '../data/metamagic-labels.data';
import { annotateAuraDesc } from '../utils/aura-range.util';
import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { DataService } from './data.service';
import {
  Character,
  CharacterCreation,
  CharacterSpellcasting,
  SpellcastingKind,
  Ability,
  AbilityKey,
  AbilityScores,
  AsiChoiceSlot,
  Size,
  Attack,
  FeatureInstance,
  EquipmentInstance,
  EquipmentSlot,
  Currency,
  SpellInstance,
  ABILITY_POINT_COSTS,
  STARTING_POINTS,
  DEFAULT_ABILITY_SCORE,
  MIN_ABILITY_SCORE,
  MAX_ABILITY_SCORE,
  CURRENT_SCHEMA_VERSION,
  ABILITY_LABEL_TO_KEY,
  getAbilityModifier,
  formatModifier,
} from '../models/Character/character';

/** Sort racial à choisir à l'étape Magie (ex. sort mineur de magicien pour l'Elfe). */
export interface RacialSpellGrant {
  choiceId: string;
  label: string;
  desc: string;
  pool: string[];
  spellLevel: number;
  spellcastingAbility: string;
}

export interface SpeciesSelection {
  speciesId: string;
  speciesName: string;
  subspeciesId: string | null;
  subspeciesName: string | null;
  racialBonuses: Partial<AbilityScores>;
  traits: FeatureInstance[];
  speed: number;
  size: Size;
  languages: string[];
  bonusLanguageCount: number;
  /** Compétences d'espèce à choisir à l'étape Savoirs (ex. Polyvalence). */
  bonusSkillCount: number;
  /** Outils d'espèce à choisir à l'étape Savoirs. */
  bonusToolCount: number;
  resistances: string[];
  hasDarkvision: boolean;
  darkvisionRadius: number;
  /** Creation-choice answers (lineage, tools, etc.) for restore when revisiting the step. */
  choiceAnswers: Record<string, string[]>;
  /** Sorts raciaux différés à l'étape Magie. */
  racialSpellGrants: RacialSpellGrant[];
}

export interface CivilizationSelection {
  civilizationId: string;
  civilizationName: string;
  languages: string[];
  writingSystems: string[];
}

export interface BackgroundSelection {
  backgroundId: string;
  backgroundName: string;
  backgroundPreset: boolean;
  skills: string[];
  tools: string[];
  proficiencies?: any;
  languages: string[];
  bonusLanguageCount: number;
  equipmentSlots: EquipmentSlot[];
  equipment: EquipmentInstance[];
  currency: Currency;
  privilegeId: string | null;
  privilegeName: string | null;
  privilegeDesc: string | null;
  selectedHandicaps: string[];
  handicapCompensationType: string | null;
  backgroundText: string;
  traits?: string;
  ideal?: string;
  bonds?: string;
  flaws?: string;
  handicap?: string;
}

export interface ClassSelection {
  classId: string;
  className: string;
  subclassId?: string;
  subclassName?: string;
  hitDie: number;
  hpAtLevel1?: number;
  hpPerLevelAverage?: number;
  hasSpellcasting: boolean;
  spellcastingKind: SpellcastingKind | null;
  spellcastingAbility: Ability | null;
  savingThrows: Ability[];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  toolProficiencies: string[];
  skillOptions: string[];
  skillChooseCount: number;
  classFeatures: FeatureInstance[];
  startingEquipmentSlots: EquipmentSlot[];
  classProgressionResources?: Record<string, number | string | null>;
  /** Langues bonus de classe (ex. Lettré) — fusionnées dans bonusLanguageCount. */
  classBonusLanguageCount?: number;
  /** Emplacements de sorts au niveau cible (JSON progression). */
  classSpellSlots?: { level: number; max: number }[];
}

export interface IdentitySelection {
  name?: string;
  sex?: 'M' | 'F' | 'X'; // <-- AJOUTÉ
  description?: string;
  background?: string;
  alignment?: string;
  traits?: string;
  ideal?: string;
  bonds?: string;
  flaws?: string;
  handicap?: string;
  story?: string;
}

export type ExtendedCharacterCreation = CharacterCreation & {
  backgroundEquipmentSlots?: EquipmentSlot[];
  toolEquipmentSlots?: EquipmentSlot[];
  backgroundProficiencies?: any;
};

const INITIAL_CREATION_STATE: ExtendedCharacterCreation = {
  speciesId: null,
  speciesName: null,
  subspeciesId: null,
  subspeciesName: null,
  racialBonuses: {},
  speciesTraits: [],
  speciesSpeed: 9,
  speciesSize: 'M',
  speciesLanguages: [],
  speciesResistances: [],
  hasDarkvision: false,
  darkvisionRadius: 0,
  speciesChoiceAnswers: {},
  speciesBonusSkillCount: 0,
  speciesBonusToolCount: 0,
  racialSpellGrants: [],

  civilizationId: null,
  civilizationName: null,
  civilizationLanguages: [],
  civilizationWritingSystems: [],

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

  targetLevel: 1,
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

  baseAbilities: {
    force: DEFAULT_ABILITY_SCORE,
    dexterite: DEFAULT_ABILITY_SCORE,
    constitution: DEFAULT_ABILITY_SCORE,
    intelligence: DEFAULT_ABILITY_SCORE,
    sagesse: DEFAULT_ABILITY_SCORE,
    charisme: DEFAULT_ABILITY_SCORE,
  },
  pointsRemaining: STARTING_POINTS,

  selectedSkills: [],

  selectedEquipment: [],
  currency: { cuivre: 0, argent: 0, or: 0, platine: 0 },

  languages: [],
  bonusLanguageCount: 0,

  name: '',
  sex: 'X' as const,

  description: '',
  background: '',
  alignment: '',
  traits: '',
  ideal: '',
  bonds: '',
  flaws: '',
  handicap: '',
  story: '',

  spellcastingDetails: {},
};

const STORAGE_KEY = 'dragon_character_builder_v6';

/** Bonus de maîtrise D&D/Dragons : +2 aux niv. 1–4, +3 aux 5–8, etc. */
export function proficiencyBonusForLevel(level: number): number {
  const lvl = Math.min(20, Math.max(1, Math.floor(level) || 1));
  return Math.floor((lvl - 1) / 4) + 2;
}

interface StoredState {
  character: CharacterCreation;
  step: number;
  editing: EditingRef | null;
}

interface EditingRef {
  id: string;
  createdAt: string;
  cloudSynced?: boolean;
}

function isConcreteStyleRef(id: string): boolean {
  if (!id) return false;
  if (id.includes('style-de-combat')) return false;
  return id.startsWith('style-') || id.startsWith('feat-style-');
}

@Injectable({ providedIn: 'root' })
export class CharacterBuilderService {
  private readonly dataService = inject(DataService);
  readonly creation = signal<ExtendedCharacterCreation>(structuredClone(INITIAL_CREATION_STATE));
  readonly currentStep = signal<number>(1);
  private readonly editingRef = signal<EditingRef | null>(null);

  constructor() {
    this.loadFromStorage();
    effect(() => {
      const data: StoredState = {
        character: this.creation(),
        step: this.currentStep(),
        editing: this.editingRef(),
      };
      this.saveToStorage(data);
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
    return this.computeArmorClass(allEquipment, this.abilityModifiers(), {
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
    this.editingRef.set({
      id: savedCharacter.id,
      createdAt: savedCharacter.createdAt,
      cloudSynced: savedCharacter.cloudSynced === true,
    });

    const species = savedCharacter.species;
    this.creation.set({
      speciesId: species.id,
      speciesName: species.label,
      subspeciesId: species.subspeciesId ?? null,
      subspeciesName: species.subspeciesLabel ?? null,
      racialBonuses: {},
      speciesTraits: savedCharacter.features.filter(
        (f) => f.source === 'species' || f.source === 'subspecies',
      ),
      speciesSpeed: savedCharacter.movement.walk,
      speciesSize: savedCharacter.size,
      speciesLanguages: [],
      speciesResistances: savedCharacter.defense.resistances,
      hasDarkvision: savedCharacter.senses.hasDarkvision,
      darkvisionRadius: savedCharacter.senses.darkvisionRadius,
      speciesChoiceAnswers: {},
      speciesBonusSkillCount: 0,
      speciesBonusToolCount: 0,
      racialSpellGrants: [],

      civilizationId: savedCharacter.civilization.id,
      civilizationName: savedCharacter.civilization.label,
      civilizationLanguages: [],
      civilizationWritingSystems: savedCharacter.proficiencies.writingSystems,

      backgroundId: savedCharacter.backgroundRef?.id ?? null,
      backgroundName: savedCharacter.backgroundRef?.label ?? null,
      backgroundPreset: savedCharacter.backgroundRef !== null,
      backgroundSkills: [],
      backgroundTools: [],
      backgroundProficiencies: null,
      backgroundLanguages: [],
      backgroundEquipment: [],
      backgroundEquipmentSlots: [],
      toolEquipmentSlots: [],
      backgroundCurrency: { cuivre: 0, argent: 0, or: 0, platine: 0 },
      privilegeId: savedCharacter.privilegeRef?.id ?? null,
      privilegeName: savedCharacter.privilegeRef?.name ?? null,
      privilegeDesc: savedCharacter.privilegeRef?.desc ?? null,
      selectedHandicaps: [],
      handicapCompensationType: null,

      classId: savedCharacter.classes[0]?.classId ?? null,
      className: savedCharacter.classes[0]?.classLabel ?? null,
      subclassId: savedCharacter.classes[0]?.subclassId ?? null,
      subclassName: savedCharacter.classes[0]?.subclassLabel ?? null,
      targetLevel: savedCharacter.totalLevel || savedCharacter.classes[0]?.level || 1,
      hitDie: savedCharacter.classes[0]?.hitDie ?? 0,
      hpAtLevel1: savedCharacter.classes[0]?.hitDie ?? 0,
      hpPerLevelAverage:
        savedCharacter.classes[0]?.hitDie
          ? Math.floor(savedCharacter.classes[0].hitDie / 2) + 1
          : 0,
      hasSpellcasting: savedCharacter.spellcasting !== null,
      spellcastingKind: savedCharacter.spellcasting?.kind ?? null,
      spellcastingAbility: savedCharacter.spellcasting?.ability ?? null,
      savingThrows: savedCharacter.proficiencies.savingThrows,
      armorProficiencies: savedCharacter.proficiencies.armor,
      weaponProficiencies: savedCharacter.proficiencies.weapons,
      toolProficiencies: savedCharacter.proficiencies.tools,
      skillOptions: [],
      skillChooseCount: savedCharacter.proficiencies.skills.length,
      classFeatures: savedCharacter.features.filter(
        (f) => f.source === 'class' || f.source === 'subclass',
      ),
      startingEquipmentSlots: [],
      classProgressionResources: {},
      classBonusLanguageCount: 0,
      classSpellSlots: [],
      classChoiceAnswers: {},
      asiBonuses: {},
      selectedFeatId: null,
      selectedFeatIds: [],
      asiChoices: [],
      expertiseSkills: savedCharacter.proficiencies.expertiseSkills ?? [],
      metamagicOptions:
        savedCharacter.spellcasting?.kind === 'sorcerer'
          ? (savedCharacter.spellcasting.metamagic ?? [])
          : [],
      eldritchInvocations:
        savedCharacter.spellcasting?.kind === 'warlock'
          ? (savedCharacter.spellcasting.eldritchInvocations ?? [])
          : [],
      pactBoon:
        savedCharacter.spellcasting?.kind === 'warlock'
          ? (savedCharacter.spellcasting.pact || null)
          : null,
      mysticArcanumPicks:
        savedCharacter.spellcasting?.kind === 'warlock'
          ? Object.fromEntries(
              (savedCharacter.spellcasting.mysticArcanum ?? []).map((a) => [
                String(a.spellLevel),
                a.spellId,
              ]),
            )
          : {},
      spellMasteryPicks:
        savedCharacter.spellcasting?.kind === 'wizard'
          ? Object.fromEntries(
              (savedCharacter.spellcasting.spellMastery ?? []).map((a) => [
                String(a.spellLevel),
                a.spellId,
              ]),
            )
          : {},
      signatureSpellIds:
        savedCharacter.spellcasting?.kind === 'wizard'
          ? (savedCharacter.spellcasting.signatureSpells ?? []).map((s) => s.spellId)
          : [],

      baseAbilities: savedCharacter.abilities,
      pointsRemaining: 0,
      selectedSkills: savedCharacter.proficiencies.skills,
      selectedEquipment: savedCharacter.equipment,
      currency: savedCharacter.currency,
      languages: savedCharacter.proficiencies.languages,
      bonusLanguageCount: 0,

      name: savedCharacter.name,
      sex: savedCharacter.personality.sex ?? 'X',
      description: savedCharacter.personality.description,
      background: savedCharacter.personality.background,
      alignment: savedCharacter.personality.alignment,
      traits: savedCharacter.personality.traits,
      ideal: savedCharacter.personality.ideal,
      bonds: savedCharacter.personality.bonds,
      flaws: savedCharacter.personality.flaws,
      handicap: savedCharacter.personality.handicap,
      story: savedCharacter.personality.story,

      spellcastingDetails:
        savedCharacter.knownSpells.length > 0
          ? {
              cantrips: savedCharacter.knownSpells
                .filter((s) => s.level === 0)
                .map((s) => ({
                  refId: s.refId,
                  name: s.name,
                  level: 0,
                  prepared: true,
                  effectSummary: s.effectSummary ?? '',
                })),
              spells: savedCharacter.knownSpells
                .filter((s) => s.level >= 1)
                .map((s) => ({
                  refId: s.refId,
                  name: s.name,
                  level: s.level,
                  prepared: s.prepared,
                  effectSummary: s.effectSummary ?? '',
                })),
            }
          : {},
    });

    this.currentStep.set(this.summaryStep());
  }

  checkForEditMode(): void {
    const editData = localStorage.getItem('dragons-edit-character');
    if (!editData) return;
    try {
      const character: Character = JSON.parse(editData);
      this.loadForEdit(character);
    } catch (error) {
      console.error('Erreur lors du chargement du personnage à éditer:', error);
    } finally {
      localStorage.removeItem('dragons-edit-character');
    }
  }

  reset(): void {
    this.creation.set(structuredClone(INITIAL_CREATION_STATE));
    this.currentStep.set(1);
    this.editingRef.set(null);
    this.clearStorage();
  }

  build(): Character {
    const c = this.creation();
    const abilities = this.finalAbilities();
    const modifiers = this.abilityModifiers();
    const hpMax = this.hitPointsMax();
    const now = new Date().toISOString();

    const spellcasting = this.buildSpellcasting(c, modifiers);
    const features: FeatureInstance[] = [...c.speciesTraits, ...c.classFeatures];
    const featIds =
      c.selectedFeatIds?.length > 0
        ? c.selectedFeatIds
        : c.selectedFeatId
          ? [c.selectedFeatId]
          : [];
    for (const featId of featIds) {
      const featSlot = c.asiChoices?.find((s) => s.mode === 'feat' && s.featId === featId);
      features.push({
        refId: featId,
        name: featId.replace(/^don-/, '').replace(/-/g, ' '),
        desc: 'Don choisi à la place d’une augmentation de caractéristique.',
        source: 'feat',
        sourceDetail: 'ASI',
        level: featSlot?.level ?? 4,
      });
    }
    const allEquipmentForAttacks = [
      ...c.selectedEquipment,
      ...((c as any).backgroundEquipment ?? []),
    ];
    const attacks = this.buildAttacks(allEquipmentForAttacks, modifiers, this.buildKnownSpells(c), {
      spellAbility: c.spellcastingAbility,
      classId: c.classId,
      classFeatures: c.classFeatures,
      resources: c.classProgressionResources ?? {},
    });

    const allEquipment = [...c.selectedEquipment, ...c.backgroundEquipment];
    const totalWeight = allEquipment.reduce((sum, item) => sum + (item.wKg ?? 0) * item.qty, 0);
    const maxCarry = abilities.force * 7.5;

    const armorClass = this.computeArmorClass(allEquipment, modifiers, {
      classId: c.classId,
      subclassId: c.subclassId,
      classFeatures: c.classFeatures,
    });

    const walkSpeed = this.computeWalkSpeed(c, allEquipment);

    const mergedCurrency: Currency = {
      cuivre: c.currency.cuivre + c.backgroundCurrency.cuivre,
      argent: c.currency.argent + c.backgroundCurrency.argent,
      or: c.currency.or + c.backgroundCurrency.or,
      platine: c.currency.platine + c.backgroundCurrency.platine,
    };

    const allTools = [...new Set([...c.toolProficiencies, ...c.backgroundTools])];

    return {
      id: this.editingRef()?.id ?? crypto.randomUUID(),
      cloudSynced: this.editingRef()?.cloudSynced ?? false,
      createdAt: this.editingRef()?.createdAt ?? now,
      updatedAt: now,
      schemaVersion: CURRENT_SCHEMA_VERSION,

      name: c.name,
      species: {
        id: c.speciesId!,
        label: c.speciesName!,
        ...(c.subspeciesId
          ? { subspeciesId: c.subspeciesId, subspeciesLabel: c.subspeciesName! }
          : {}),
      },
      size: c.speciesSize,
      civilization: { id: c.civilizationId!, label: c.civilizationName! },

      backgroundRef: c.backgroundId ? { id: c.backgroundId, label: c.backgroundName! } : null,
      privilegeRef: c.privilegeId
        ? { id: c.privilegeId, name: c.privilegeName!, desc: c.privilegeDesc! }
        : null,

      classes: [
        {
          classId: c.classId!,
          classLabel: c.className!,
          ...(c.subclassId ? { subclassId: c.subclassId, subclassLabel: c.subclassName! } : {}),
          level: this.targetLevel(),
          hitDie: c.hitDie,
        },
      ],
      totalLevel: this.targetLevel(),
      experience: 0,

      abilities,
      abilityModifiers: modifiers,
      proficiencyBonus: this.proficiencyBonus(),

      vitality: {
        hitPointsMax: hpMax,
        hitPointsCurrent: hpMax,
        hitPointsTemporary: 0,
        woundThreshold: Math.ceil(hpMax / 2),
        hitDice: [{ dieType: c.hitDie, total: this.targetLevel(), used: 0 }],
        fatigue: 0,
        deathSaves: { successes: 0, failures: 0 },
        inspiration: false,
      },
      defense: {
        armorClass,
        armorType: this.findEquippedArmorName(allEquipment),
        hasShield: allEquipment.some(
          (e) => e.equipped && e.name.toLowerCase().includes('bouclier'),
        ),
        resistances: c.speciesResistances,
        immunities: [],
        vulnerabilities: [],
        conditionImmunities: [],
        harmfulStates: [],
      },
      initiative: modifiers.dexterite,
      attacks,

      movement: {
        walk: walkSpeed,
        climb: Math.floor(walkSpeed / 2),
        swim: Math.floor(walkSpeed / 2),
        jumpHeight: 3 + modifiers.force,
        jumpLength: 3 + modifiers.force,
      },
      senses: {
        passivePerception: this.passivePerception(),
        hasDarkvision: c.hasDarkvision,
        darkvisionRadius: c.darkvisionRadius,
      },

      proficiencies: {
        armor: c.armorProficiencies,
        weapons: c.weaponProficiencies,
        tools: allTools,
        savingThrows: c.savingThrows,
        skills: [...new Set([...c.selectedSkills, ...c.backgroundSkills])],
        expertiseSkills: c.expertiseSkills ?? [],
        languages: c.languages,
        writingSystems: c.civilizationWritingSystems,
      },
      features,

      equipment: allEquipment,
      currency: mergedCurrency,
      carryCapacity: {
        currentKg: Math.round(totalWeight * 10) / 10,
        maxKg: maxCarry,
        encumberedAtKg: Math.round((maxCarry * 2) / 3),
        heavilyEncumberedAtKg: Math.round((maxCarry * 5) / 6),
        status:
          totalWeight > (maxCarry * 5) / 6
            ? 'heavily_encumbered'
            : totalWeight > (maxCarry * 2) / 3
              ? 'encumbered'
              : 'normal',
      },

      spellcasting,
      knownSpells: this.buildKnownSpells(c),
      classResources: Object.fromEntries(
        Object.entries(c.classProgressionResources ?? {})
          .filter(([, v]) => typeof v === 'number' && Number.isFinite(v))
          .map(([k, v]) => [k, Number(v)]),
      ),
      ammunition: [],
      notes: '',

      personality: {
        description: c.description,
        sex: c.sex, // <-- AJOUTÉ
        background: c.background,
        backgroundId: c.backgroundId,
        story: c.story,
        awakened: false,
        ideal: c.ideal,
        traits: c.traits,
        alignment: c.alignment,
        bonds: c.bonds,
        flaws: c.flaws,
        handicap: c.handicap,
        madness: '',
        corruption: { stage1: 0, stage2: 0, stage3: 0, stage4: 0 },
      },
    };
  }

  private buildSpellcasting(
    c: CharacterCreation,
    modifiers: AbilityScores,
  ): CharacterSpellcasting | null {
    if (!c.hasSpellcasting || !c.spellcastingKind || !c.spellcastingAbility) return null;
    const abilityKey = ABILITY_LABEL_TO_KEY[c.spellcastingAbility];
    const spellMod = modifiers[abilityKey] ?? 0;
    const details = c.spellcastingDetails as
      | { cantrips?: unknown[]; spells?: unknown[] }
      | undefined;
    const cantripCount = Array.isArray(details?.cantrips) ? details.cantrips.length : 0;
    const focus = this.detectFocus(c);
    const level = Math.min(20, Math.max(1, c.targetLevel || 1));
    const prof = proficiencyBonusForLevel(level);
    const slots = this.spellSlotsForLevel(c.spellcastingKind, level, c.classSpellSlots).map((s) => ({
      ...s,
      used: 0,
    }));
    const base = {
      ability: c.spellcastingAbility,
      spellSaveDC: 8 + prof + spellMod,
      spellAttackBonus: prof + spellMod,
      focus,
      spellSlots: slots,
      cantrips: { max: cantripCount, used: 0 },
    };
    switch (c.spellcastingKind) {
      case 'wizard': {
        const masteryDetail = ((details as any)?.spellMastery ?? []) as {
          spellLevel: number;
          spellId: string;
          spellName: string;
        }[];
        const sigDetail = ((details as any)?.signatureSpells ?? []) as {
          spellId: string;
          spellName: string;
        }[];
        const masteryFromCreation = Object.entries(c.spellMasteryPicks ?? {}).map(
          ([lvl, spellId]) => {
            const spellLevel = Number(lvl);
            const hit = masteryDetail.find((d) => d.spellLevel === spellLevel);
            return {
              spellLevel,
              spellId,
              spellName: hit?.spellName ?? spellId,
            };
          },
        );
        const signatureFromCreation = (c.signatureSpellIds ?? []).map((spellId) => {
          const hit = sigDetail.find((d) => d.spellId === spellId);
          return { spellId, spellName: hit?.spellName ?? spellId };
        });
        return {
          ...base,
          kind: 'wizard',
          arcaneTradition: (details as any)?.arcaneTradition ?? c.subclassName ?? '',
          spellMastery: masteryDetail.length ? masteryDetail : masteryFromCreation,
          signatureSpells: sigDetail.length ? sigDetail : signatureFromCreation,
        };
      }
      case 'sorcerer':
        return {
          ...base,
          kind: 'sorcerer',
          atavism: (details as any)?.atavism ?? c.subclassName ?? '',
          sorceryPoints: {
            max: Number(c.classProgressionResources?.['arcane_points'] ?? 0) || 0,
            current: Number(c.classProgressionResources?.['arcane_points'] ?? 0) || 0,
          },
          metamagic: (c.metamagicOptions ?? []).map(metamagicLabel),
        };
      case 'warlock': {
        const arcanumPicks = c.mysticArcanumPicks ?? {};
        const detailArcanum = ((details as any)?.mysticArcanum ?? []) as {
          spellLevel: number;
          spellId: string;
          spellName: string;
        }[];
        const mysticArcanum = Object.entries(arcanumPicks)
          .map(([lvl, spellId]) => {
            const spellLevel = Number(lvl);
            const hit = detailArcanum.find(
              (d) => d.spellLevel === spellLevel || d.spellId === spellId,
            );
            return {
              spellLevel,
              spellId,
              spellName: hit?.spellName ?? spellId,
            };
          })
          .filter((a) => a.spellLevel >= 6 && !!a.spellId)
          .sort((a, b) => a.spellLevel - b.spellLevel);
        return {
          ...base,
          kind: 'warlock',
          patron: (details as any)?.patron ?? c.subclassName ?? '',
          pact: pactBoonLabel(c.pactBoon),
          eldritchInvocations: (c.eldritchInvocations ?? []).map(invocationLabel),
          mysticArcanum,
        };
      }
      case 'cleric': {
        const channelUses =
          Number(c.classProgressionResources?.['conduit_divin_uses'] ?? 0) || 1;
        const channels = (c.classFeatures ?? [])
          .filter((f) => {
            const id = f.refId ?? '';
            return (
              id.startsWith('feat-conduit-divin-') &&
              !id.endsWith('-2repos') &&
              !id.endsWith('-3repos')
            );
          })
          .map((f) => ({
            id: f.refId ?? '',
            name: f.name,
            desc: f.desc ?? '',
            uses: { max: channelUses, current: channelUses },
          }));
        return {
          ...base,
          kind: 'cleric',
          deity: (details as any)?.deity ?? '',
          domain: (details as any)?.domain ?? c.subclassName ?? '',
          divineChannels: channels,
        };
      }
      case 'druid': {
        const hasTrance = (c.classFeatures ?? []).some(
          (f) => f.refId === 'feat-transe-mystique',
        );
        const circleFromDetails = ((details as any)?.circleSpells ?? []) as string[];
        return {
          ...base,
          kind: 'druid',
          druidCircle: (details as any)?.druidCircle ?? c.subclassName ?? '',
          circleSpells: circleFromDetails,
          mysticTranceAvailable: hasTrance,
          mysticTranceUsed: false,
        };
      }
      case 'bard':
        return { ...base, kind: 'bard', bardicCollege: c.subclassName ?? '' };
      case 'ranger':
        return {
          ...base,
          kind: 'ranger',
          knownSpellsCount: Array.isArray(details?.spells) ? details.spells.length : 0,
        };
      case 'paladin': {
        const oathFromDetails = ((details as any)?.oathSpells ?? []) as {
          characterLevel: number;
          spells: string[];
        }[];
        return {
          ...base,
          kind: 'paladin',
          oath: c.subclassName ?? '',
          oathSpells: oathFromDetails,
        };
      }
      case 'fighter_eldritch_knight':
        return {
          ...base,
          kind: 'fighter_eldritch_knight',
          soulWeapon: {
            name: '',
            bondedAbilityModifiers: { intelligence: 0, sagesse: 0, charisme: 0 },
          },
          magicAbility: 'Intelligence',
        };
      default:
        return null;
    }
  }

  /**
   * Emplacements de sorts selon le type d'incantateur et le niveau.
   * Tables SRD-like (full / half / warlock) — suffisant tant que la classe
   * n'expose pas encore sa progression complète côté builder.
   */
  private spellSlotsForLevel(
    kind: SpellcastingKind | null,
    level: number,
    jsonSlots?: { level: number; max: number }[],
  ): { level: number; max: number }[] {
    if (!kind) return [];
    if (jsonSlots?.length) return jsonSlots.map((s) => ({ ...s }));
    const lvl = Math.min(20, Math.max(1, level));

    const FULL: Record<number, number[]> = {
      1: [2],
      2: [3],
      3: [4, 2],
      4: [4, 3],
      5: [4, 3, 2],
      6: [4, 3, 3],
      7: [4, 3, 3, 1],
      8: [4, 3, 3, 2],
      9: [4, 3, 3, 3, 1],
      10: [4, 3, 3, 3, 2],
      11: [4, 3, 3, 3, 2, 1],
      12: [4, 3, 3, 3, 2, 1],
      13: [4, 3, 3, 3, 2, 1, 1],
      14: [4, 3, 3, 3, 2, 1, 1],
      15: [4, 3, 3, 3, 2, 1, 1, 1],
      16: [4, 3, 3, 3, 2, 1, 1, 1],
      17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
      18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
      19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
      20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
    };
    const HALF: Record<number, number[]> = {
      1: [],
      2: [2],
      3: [3],
      4: [3],
      5: [4, 2],
      6: [4, 2],
      7: [4, 3],
      8: [4, 3],
      9: [4, 3, 2],
      10: [4, 3, 2],
      11: [4, 3, 3],
      12: [4, 3, 3],
      13: [4, 3, 3, 1],
      14: [4, 3, 3, 1],
      15: [4, 3, 3, 2],
      16: [4, 3, 3, 2],
      17: [4, 3, 3, 3, 1],
      18: [4, 3, 3, 3, 1],
      19: [4, 3, 3, 3, 2],
      20: [4, 3, 3, 3, 2],
    };
    // Pact magic : (slotLevel, count) approx
    const WARLOCK: Record<number, { slotLevel: number; count: number }> = {
      1: { slotLevel: 1, count: 1 },
      2: { slotLevel: 1, count: 2 },
      3: { slotLevel: 2, count: 2 },
      4: { slotLevel: 2, count: 2 },
      5: { slotLevel: 3, count: 2 },
      6: { slotLevel: 3, count: 2 },
      7: { slotLevel: 4, count: 2 },
      8: { slotLevel: 4, count: 2 },
      9: { slotLevel: 5, count: 2 },
      10: { slotLevel: 5, count: 2 },
      11: { slotLevel: 5, count: 3 },
      12: { slotLevel: 5, count: 3 },
      13: { slotLevel: 5, count: 3 },
      14: { slotLevel: 5, count: 3 },
      15: { slotLevel: 5, count: 3 },
      16: { slotLevel: 5, count: 3 },
      17: { slotLevel: 5, count: 4 },
      18: { slotLevel: 5, count: 4 },
      19: { slotLevel: 5, count: 4 },
      20: { slotLevel: 5, count: 4 },
    };

    const fullKinds: SpellcastingKind[] = [
      'wizard',
      'sorcerer',
      'bard',
      'cleric',
      'druid',
    ];
    const halfKinds: SpellcastingKind[] = [
      'paladin',
      'ranger',
      'fighter_eldritch_knight',
    ];

    if (kind === 'warlock') {
      const w = WARLOCK[lvl] ?? WARLOCK[1];
      return [{ level: w.slotLevel, max: w.count }];
    }

    const table = fullKinds.includes(kind)
      ? FULL
      : halfKinds.includes(kind)
        ? HALF
        : FULL;
    const counts = table[lvl] ?? [];
    return counts
      .map((max, i) => ({ level: i + 1, max }))
      .filter((s) => s.max > 0);
  }

  private detectFocus(c: CharacterCreation): string | null {
    const KEYWORDS = [
      'luth',
      'lyre',
      'flûte',
      'flute',
      'tambour',
      'viole',
      'cor',
      'cornemuse',
      'bombarde',
      'dulcimer',
      'baguette',
      'orbe',
      'bâton',
      'cristal',
      'focaliseur',
      'sceptre',
      'symbole sacré',
      'reliquaire',
      'amulette',
      'emblème',
      'totem',
      'gui',
    ];
    const allEquip = [...c.selectedEquipment, ...((c as any).backgroundEquipment ?? [])];
    for (const eq of allEquip) {
      const name = eq.name.toLowerCase();
      if (KEYWORDS.some((k) => name.includes(k))) return eq.name;
    }
    return null;
  }

  private buildKnownSpells(c: CharacterCreation): SpellInstance[] {
    const details = c.spellcastingDetails as
      | {
          cantrips?: {
            refId: string;
            name: string;
            level: number;
            prepared: boolean;
            effectSummary?: string;
          }[];
          spells?: {
            refId: string;
            name: string;
            level: number;
            prepared: boolean;
            alwaysPrepared?: boolean;
            effectSummary?: string;
          }[];
        }
      | undefined;
    if (!details) return [];
    const result: SpellInstance[] = [];
    if (details.cantrips)
      for (const s of details.cantrips)
        result.push({
          refId: s.refId,
          name: s.name,
          level: 0,
          prepared: true,
          effectSummary: s.effectSummary,
        });
    if (details.spells)
      for (const s of details.spells)
        result.push({
          refId: s.refId,
          name: s.name,
          level: s.level,
          prepared: s.prepared ?? true,
          alwaysPrepared: s.alwaysPrepared,
          effectSummary: s.effectSummary,
        });
    return result;
  }

  private buildAttacks(
    equipment: EquipmentInstance[],
    modifiers: AbilityScores,
    knownSpells: SpellInstance[] = [],
    ctx: {
      spellAbility?: Ability | null;
      classId?: string | null;
      classFeatures?: FeatureInstance[];
      resources?: Record<string, number | string | null>;
    } = {},
  ): Attack[] {
    const profBonus = this.proficiencyBonus();
    const spellAbility = ctx.spellAbility ?? null;
    const isMonk = ctx.classId === 'cls-moine';
    const martialArtsDie =
      typeof ctx.resources?.['martial_arts_die'] === 'string'
        ? String(ctx.resources['martial_arts_die'])
        : isMonk
          ? '1d4'
          : null;
    const unarmored = this.isUnarmoredForMonk(equipment);
    const canUseMartialArts = isMonk && unarmored && !!martialArtsDie;
    const extraAttacks = Math.max(0, Number(ctx.resources?.['extra_attacks'] ?? 0) || 0);

    const weaponAttacks = equipment
      .filter(
        (eq) =>
          (eq.customData as { isWeapon?: boolean })?.isWeapon === true ||
          (eq.refId ?? '').startsWith('wp-'),
      )
      .map((eq) => {
        const wd = (eq.customData ?? {}) as {
          damage?: string;
          damageType?: string;
          properties?: string[];
          subtype?: string | null;
        };
        const props = (wd.properties ?? []).map((p) => p.toLowerCase());
        const isRanged = props.some((p) => p.includes('projectile') || p.includes('lancer'));
        const isFinesse = props.some((p) => p.includes('finesse'));
        const monkWeapon = canUseMartialArts && this.isMonkWeapon(eq, props, wd.subtype);
        const abilityMod = isRanged
          ? modifiers.dexterite
          : isFinesse || monkWeapon
            ? Math.max(modifiers.force, modifiers.dexterite)
            : modifiers.force;
        const attackBonus = abilityMod + profBonus;
        const dmgMod = abilityMod >= 0 ? `+${abilityMod}` : `${abilityMod}`;
        let damageDie = wd.damage ?? '?';
        if (monkWeapon && martialArtsDie && damageDie !== '?') {
          damageDie = this.pickHigherDie(damageDie, martialArtsDie);
        } else if (monkWeapon && martialArtsDie) {
          damageDie = martialArtsDie;
        }
        const rangeProp = (wd.properties ?? []).find(
          (p) => p.toLowerCase().includes('projectile') || p.toLowerCase().includes('lancer'),
        );
        return {
          name: eq.name,
          source: 'weapon' as const,
          refId: eq.refId,
          attackBonus,
          damage: `${damageDie}${damageDie !== '?' ? dmgMod : ''}`,
          damageType: wd.damageType ?? (monkWeapon ? 'contondant' : ''),
          range: isRanged ? (rangeProp ?? 'Distance') : 'Corps à corps',
          properties: [
            ...(wd.properties ?? []),
            ...(extraAttacks > 0 && !isRanged
              ? [`Attaques ×${1 + extraAttacks}`]
              : extraAttacks > 0
                ? [`Attaques ×${1 + extraAttacks}`]
                : []),
          ],
        };
      });

    // Arts martiaux : attaque à mains nues
    if (canUseMartialArts && martialArtsDie) {
      const abilityMod = Math.max(modifiers.force, modifiers.dexterite);
      const dmgMod = abilityMod >= 0 ? `+${abilityMod}` : `${abilityMod}`;
      weaponAttacks.unshift({
        name: 'Mains nues',
        source: 'weapon' as const,
        refId: 'atk-unarmed-monk',
        attackBonus: abilityMod + profBonus,
        damage: `${martialArtsDie}${dmgMod}`,
        damageType: 'contondant',
        range: 'Corps à corps',
        properties: [
          'Arts martiaux',
          ...(extraAttacks > 0 ? [`Attaques ×${1 + extraAttacks}`] : []),
        ],
      });
    }

    // Cantrips / sorts d'attaque (ex. Flamme sacrée) si pas assez d'armes
    const spellAttacks: Attack[] = [];
    if (weaponAttacks.length < 5 && knownSpells.length > 0) {
      const spellMod = spellAbility
        ? modifiers[ABILITY_LABEL_TO_KEY[spellAbility]] ?? 0
        : modifiers.sagesse;
      const attackBonus = spellMod + profBonus;
      for (const sp of knownSpells) {
        if (spellAttacks.length + weaponAttacks.length >= 5) break;
        if (sp.level > 0) continue; // cantrips prioritaires pour la section attaques
        const summary = (sp.effectSummary ?? '').toLowerCase();
        const name = sp.name.toLowerCase();
        const looksOffensive =
          /dégât|degat|attaque|rayon|flamme|bolt|projectile|blessure|missile/.test(
            summary + ' ' + name,
          );
        if (!looksOffensive) continue;
        spellAttacks.push({
          name: sp.name,
          source: 'spell',
          refId: sp.refId,
          attackBonus,
          damage: 'sort',
          damageType: '',
          range: 'Sort',
          properties: [],
        });
      }
    }

    return [...weaponAttacks, ...spellAttacks];
  }

  /** Vitesse de marche : espèce + bonus moine sans armure (mètres). */
  private computeWalkSpeed(
    c: CharacterCreation,
    equipment: EquipmentInstance[],
  ): number {
    let walk = c.speciesSpeed || 9;
    const isMonk =
      c.classId === 'cls-moine' ||
      (c.classFeatures ?? []).some(
        (f) =>
          f.refId === 'feat-deplacement-sans-armure' ||
          f.refId === 'feat-mouvement-sans-armure',
      );
    if (isMonk && this.isUnarmoredForMonk(equipment)) {
      const bonus = Number(c.classProgressionResources?.['unarmored_movement_bonus_m'] ?? 0);
      if (!Number.isNaN(bonus) && bonus > 0) walk += bonus;
    }
    return walk;
  }

  private isUnarmoredForMonk(equipment: EquipmentInstance[]): boolean {
    const armor = equipment.find(
      (e) =>
        e.equipped &&
        (e.customData as { isArmor?: boolean; isShield?: boolean })?.isArmor &&
        !(e.customData as { isShield?: boolean })?.isShield,
    );
    const shield = equipment.find(
      (e) => e.equipped && (e.customData as { isShield?: boolean })?.isShield,
    );
    return !armor && !shield;
  }

  private isMonkWeapon(
    eq: EquipmentInstance,
    props: string[],
    subtype: string | null | undefined,
  ): boolean {
    const id = eq.refId ?? '';
    if (id === 'wp-epee-courte' || id === 'wp-cimeterre') return true;
    const sub = (subtype ?? '').toUpperCase();
    const isSimpleMelee =
      sub === 'SIMPLE_MELEE' ||
      sub.includes('SIMPLE_MELEE') ||
      (sub.includes('SIMPLE') && sub.includes('MELEE'));
    if (!isSimpleMelee) return false;
    const heavyOrTwoHanded = props.some(
      (p) =>
        p.includes('lourde') ||
        p.includes('heavy') ||
        p.includes('deux mains') ||
        p.includes('two-handed') ||
        p.includes('deux_mains'),
    );
    return !heavyOrTwoHanded;
  }

  /** Choisit le dé de dégâts le plus avantageux (ex. 1d6 > 1d4). */
  private pickHigherDie(a: string, b: string): string {
    const avg = (die: string): number => {
      const m = die.match(/(\d*)d(\d+)/i);
      if (!m) return 0;
      const n = parseInt(m[1] || '1', 10);
      const sides = parseInt(m[2], 10);
      return n * ((sides + 1) / 2);
    };
    return avg(a) >= avg(b) ? a : b;
  }

  /**
   * CA : armure équipée (avec plafond Dex) ou défense sans armure de classe,
   * + bouclier si autorisé, + style Défense (+1 avec armure).
   */
  private computeArmorClass(
    equipment: EquipmentInstance[],
    modifiers: AbilityScores,
    ctx?: {
      classId?: string | null;
      subclassId?: string | null;
      classFeatures?: FeatureInstance[];
    },
  ): number {
    const armor = equipment.find(
      (e) =>
        e.equipped &&
        (e.customData as { isArmor?: boolean; isShield?: boolean })?.isArmor &&
        !(e.customData as { isShield?: boolean })?.isShield,
    );
    const shield = equipment.find(
      (e) => e.equipped && (e.customData as { isShield?: boolean })?.isShield,
    );

    const classId = ctx?.classId ?? null;
    const subclassId = ctx?.subclassId ?? null;
    const features = ctx?.classFeatures ?? [];
    const featureIds = new Set(features.map((f) => f.refId));

    const hasBarbarianUD =
      classId === 'cls-barbare' || featureIds.has('feat-defense-sans-armure');
    const hasMonkUD =
      classId === 'cls-moine' || featureIds.has('feat-defense-sans-armure-moine');
    const hasDraconicResilience =
      subclassId === 'subcls-lignee-draconique' ||
      featureIds.has('feat-resistance-draconique');
    const hasDefenseStyle = features.some(
      (f) =>
        f.refId === 'style-defense' ||
        f.refId === 'feat-style-defense' ||
        f.refId === 'style-defense-rodeur' ||
        /^style-defense/i.test(f.refId ?? '') ||
        /Style\s*:\s*Défense/i.test(f.name ?? ''),
    );

    let ac: number;

    if (armor) {
      const data = armor.customData as {
        ac?: number;
        dexModifier?: { type?: string; max?: number } | string;
        maxDexBonus?: number | null;
      };
      const base = data.ac ?? 10;
      let dexBonus = modifiers.dexterite;
      const dexMod = data.dexModifier;
      const dexType = typeof dexMod === 'string' ? dexMod : dexMod?.type;

      if (dexType === 'none') {
        dexBonus = 0;
      } else if (dexType === 'max' || data.maxDexBonus != null) {
        const cap =
          data.maxDexBonus ??
          (typeof dexMod === 'object' ? dexMod?.max : undefined) ??
          2;
        dexBonus = Math.min(dexBonus, cap);
      }
      ac = base + dexBonus;

      if (hasDefenseStyle) ac += 1;
    } else {
      // Défense sans armure / résilience
      if (hasBarbarianUD) {
        ac = 10 + modifiers.dexterite + modifiers.constitution;
      } else if (hasMonkUD && !shield) {
        // Moine : pas d'armure ni de bouclier
        ac = 10 + modifiers.dexterite + modifiers.sagesse;
      } else if (hasDraconicResilience) {
        ac = 13 + modifiers.dexterite;
      } else {
        ac = 10 + modifiers.dexterite;
      }
    }

    // Bouclier : OK pour barbare / draconique / armure ; interdit pour la DSA moine
    if (shield) {
      const monkBlocksShield = hasMonkUD && !armor;
      if (!monkBlocksShield) {
        const shieldAc = (shield.customData as { ac?: number })?.ac ?? 2;
        ac += shieldAc;
      }
    }

    return ac;
  }

  private findEquippedArmorName(equipment: EquipmentInstance[]): string {
    return (
      equipment.find((e) => e.equipped && (e.customData as { isArmor?: boolean })?.isArmor)?.name ??
      'Aucune'
    );
  }

  getModifier(score: number): number {
    return getAbilityModifier(score);
  }

  formatMod(score: number): string {
    return formatModifier(getAbilityModifier(score));
  }

  private saveToStorage(data: StoredState): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Erreur sauvegarde localStorage', e);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored =
        localStorage.getItem(STORAGE_KEY) ??
        localStorage.getItem('dragon_character_builder_v5') ??
        localStorage.getItem('dragon_character_builder_v4');
      if (!stored) return;
      const parsed: StoredState = JSON.parse(stored);
      if (parsed.character) {
        const c = parsed.character as ExtendedCharacterCreation;
        this.creation.set({
          ...structuredClone(INITIAL_CREATION_STATE),
          ...c,
          targetLevel: Math.min(20, Math.max(1, c.targetLevel || 1)),
          hpAtLevel1: c.hpAtLevel1 ?? 0,
          hpPerLevelAverage: c.hpPerLevelAverage ?? 0,
          classProgressionResources: c.classProgressionResources ?? {},
          classChoiceAnswers: c.classChoiceAnswers ?? {},
          asiBonuses: c.asiBonuses ?? {},
          selectedFeatId: c.selectedFeatId ?? null,
          selectedFeatIds: c.selectedFeatIds ?? (c.selectedFeatId ? [c.selectedFeatId] : []),
          asiChoices: c.asiChoices ?? [],
          expertiseSkills: c.expertiseSkills ?? [],
          metamagicOptions: c.metamagicOptions ?? [],
          eldritchInvocations: c.eldritchInvocations ?? [],
          pactBoon: c.pactBoon ?? null,
          mysticArcanumPicks: c.mysticArcanumPicks ?? {},
          spellMasteryPicks: c.spellMasteryPicks ?? {},
          signatureSpellIds: c.signatureSpellIds ?? [],
        });
      }
      if (parsed.step) this.currentStep.set(parsed.step);
      if (parsed.editing) this.editingRef.set(parsed.editing);
    } catch (e) {
      console.error('Erreur lecture localStorage', e);
      this.clearStorage();
    }
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
