import { Injectable, signal, computed, effect } from '@angular/core';
import {
  Character,
  CharacterCreation,
  CharacterSpellcasting,
  SpellcastingKind,
  Ability,
  AbilityKey,
  AbilityScores,
  Size,
  Attack,
  FeatureInstance,
  EquipmentInstance,
  EquipmentSlot,
  Currency,
  SpellInstance,
  CatalogRef,
  ABILITY_POINT_COSTS,
  STARTING_POINTS,
  DEFAULT_ABILITY_SCORE,
  MIN_ABILITY_SCORE,
  MAX_ABILITY_SCORE,
  CURRENT_SCHEMA_VERSION,
  ABILITY_KEY_TO_LABEL,
  ABILITY_LABEL_TO_KEY,
  getAbilityModifier,
  formatModifier,
} from '../models/Character/character';

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
  resistances: string[];
  hasDarkvision: boolean;
  darkvisionRadius: number;
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

  classId: null,
  className: null,
  subclassId: null,
  subclassName: null,
  hitDie: 0,
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

const STORAGE_KEY = 'dragon_character_builder_v4';

interface StoredState {
  character: CharacterCreation;
  step: number;
  editing: EditingRef | null;
}

interface EditingRef {
  id: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class CharacterBuilderService {
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

    if (this.creation().hasSpellcasting) {
      base.push({ number: 9, title: 'Magie', icon: '✨' });
      base.push({ number: 10, title: 'Identité', icon: '📜' });
      base.push({ number: 11, title: 'Récapitulatif', icon: '✅' });
    } else {
      base.push({ number: 9, title: 'Identité', icon: '📜' });
      base.push({ number: 10, title: 'Récapitulatif', icon: '✅' });
    }

    return base;
  });

  readonly totalSteps = computed(() => this.steps().length);
  readonly summaryStep = computed(() => this.totalSteps());

  readonly finalAbilities = computed<AbilityScores>(() => {
    const c = this.creation();
    const base = c.baseAbilities;
    const bonuses = c.racialBonuses;
    return {
      force: base.force + (bonuses.force ?? 0),
      dexterite: base.dexterite + (bonuses.dexterite ?? 0),
      constitution: base.constitution + (bonuses.constitution ?? 0),
      intelligence: base.intelligence + (bonuses.intelligence ?? 0),
      sagesse: base.sagesse + (bonuses.sagesse ?? 0),
      charisme: base.charisme + (bonuses.charisme ?? 0),
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
    return this.creation().hitDie + this.abilityModifiers().constitution;
  });

  readonly woundThreshold = computed<number>(() => {
    return Math.ceil(this.hitPointsMax() / 2);
  });

  readonly baseArmorClass = computed<number>(() => {
    return 10 + this.abilityModifiers().dexterite;
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
        if (c.hasSpellcasting) return true;
        return c.name.trim().length > 0;
      case 10:
        if (c.hasSpellcasting) return c.name.trim().length > 0;
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
        backgroundSkills: [],
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

  setClass(selection: ClassSelection): void {
    this.creation.update((c) => ({
      ...c,
      classId: selection.classId,
      className: selection.className,
      subclassId: selection.subclassId ?? null,
      subclassName: selection.subclassName ?? null,
      hitDie: selection.hitDie,
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
      selectedSkills: [],
      selectedEquipment: [],
      spellcastingDetails: {},
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
      hitDie: savedCharacter.classes[0]?.hitDie ?? 0,
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
    const attacks = this.buildAttacks(c.selectedEquipment, modifiers);

    const allEquipment = [...c.selectedEquipment, ...c.backgroundEquipment];
    const totalWeight = allEquipment.reduce((sum, item) => sum + (item.wKg ?? 0) * item.qty, 0);
    const maxCarry = abilities.force * 7.5;

    const mergedCurrency: Currency = {
      cuivre: c.currency.cuivre + c.backgroundCurrency.cuivre,
      argent: c.currency.argent + c.backgroundCurrency.argent,
      or: c.currency.or + c.backgroundCurrency.or,
      platine: c.currency.platine + c.backgroundCurrency.platine,
    };

    const allTools = [...new Set([...c.toolProficiencies, ...c.backgroundTools])];

    return {
      id: this.editingRef()?.id ?? crypto.randomUUID(),
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
          level: 1,
          hitDie: c.hitDie,
        },
      ],
      totalLevel: 1,
      experience: 0,

      abilities,
      abilityModifiers: modifiers,
      proficiencyBonus: 2,

      vitality: {
        hitPointsMax: hpMax,
        hitPointsCurrent: hpMax,
        hitPointsTemporary: 0,
        woundThreshold: Math.ceil(hpMax / 2),
        hitDice: [{ dieType: c.hitDie, total: 1, used: 0 }],
        fatigue: 0,
        deathSaves: { successes: 0, failures: 0 },
        inspiration: false,
      },
      defense: {
        armorClass: this.computeArmorClass(allEquipment, modifiers),
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
        walk: c.speciesSpeed,
        climb: Math.floor(c.speciesSpeed / 2),
        swim: Math.floor(c.speciesSpeed / 2),
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
        expertiseSkills: [],
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
    const LEVEL1_SLOTS: Record<string, { level: number; max: number }[]> = {
      bard: [{ level: 1, max: 2 }],
      wizard: [{ level: 1, max: 2 }],
      sorcerer: [{ level: 1, max: 2 }],
      cleric: [{ level: 1, max: 2 }],
      druid: [{ level: 1, max: 2 }],
      warlock: [{ level: 1, max: 1 }],
      ranger: [{ level: 1, max: 0 }],
      paladin: [{ level: 1, max: 0 }],
      fighter_eldritch_knight: [{ level: 1, max: 0 }],
    };
    const focus = this.detectFocus(c);
    const slots = (LEVEL1_SLOTS[c.spellcastingKind] ?? [{ level: 1, max: 2 }]).map((s) => ({
      ...s,
      used: 0,
    }));
    const base = {
      ability: c.spellcastingAbility,
      spellSaveDC: 8 + 2 + spellMod,
      spellAttackBonus: 2 + spellMod,
      focus,
      spellSlots: slots,
      cantrips: { max: cantripCount, used: 0 },
    };
    switch (c.spellcastingKind) {
      case 'wizard':
        return {
          ...base,
          kind: 'wizard',
          arcaneTradition: (details as any)?.arcaneTradition ?? '',
        };
      case 'sorcerer':
        return {
          ...base,
          kind: 'sorcerer',
          atavism: (details as any)?.atavism ?? '',
          sorceryPoints: { max: 0, current: 0 },
          metamagic: [],
        };
      case 'warlock':
        return {
          ...base,
          kind: 'warlock',
          patron: (details as any)?.patron ?? '',
          pact: '',
          eldritchInvocations: [],
        };
      case 'cleric':
        return {
          ...base,
          kind: 'cleric',
          deity: (details as any)?.deity ?? '',
          domain: (details as any)?.domain ?? '',
          divineChannels: [],
        };
      case 'druid':
        return {
          ...base,
          kind: 'druid',
          druidCircle: '',
          circleSpells: [],
          mysticTranceAvailable: false,
          mysticTranceUsed: false,
        };
      case 'bard':
        return { ...base, kind: 'bard', bardicCollege: c.subclassName ?? '' };
      case 'ranger':
        return {
          ...base,
          kind: 'ranger',
          knownSpellsCount: Array.isArray(details?.spells) ? details.spells.length : 0,
        };
      case 'paladin':
        return { ...base, kind: 'paladin', oath: c.subclassName ?? '', oathSpells: [] };
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
          prepared: true,
          effectSummary: s.effectSummary,
        });
    return result;
  }

  private buildAttacks(equipment: EquipmentInstance[], modifiers: AbilityScores): Attack[] {
    const profBonus = 2;
    return equipment
      .filter((eq) => (eq.customData as { isWeapon?: boolean })?.isWeapon === true)
      .map((eq) => {
        const wd = eq.customData as {
          damage: string;
          damageType: string;
          properties: string[];
          subtype: string | null;
        };
        const props = wd.properties.map((p) => p.toLowerCase());
        const isRanged = props.some((p) => p.includes('projectile') || p.includes('lancer'));
        const isFinesse = props.some((p) => p.includes('finesse'));
        let abilityMod = isRanged
          ? modifiers.dexterite
          : isFinesse
            ? Math.max(modifiers.force, modifiers.dexterite)
            : modifiers.force;
        const attackBonus = abilityMod + profBonus;
        const dmgMod = abilityMod >= 0 ? `+${abilityMod}` : `${abilityMod}`;
        const rangeProp = wd.properties.find(
          (p) => p.toLowerCase().includes('projectile') || p.toLowerCase().includes('lancer'),
        );
        return {
          name: eq.name,
          source: 'weapon' as const,
          refId: eq.refId,
          attackBonus,
          damage: `${wd.damage}${dmgMod}`,
          damageType: wd.damageType,
          range: isRanged ? (rangeProp ?? 'Distance') : 'Corps à corps',
          properties: wd.properties,
        };
      });
  }

  private computeArmorClass(equipment: EquipmentInstance[], modifiers: AbilityScores): number {
    return 10 + modifiers.dexterite;
  }

  private findEquippedArmorName(equipment: EquipmentInstance[]): string {
    return equipment.find((e) => e.equipped && e.location === 'equipped')?.name ?? 'Aucune';
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
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return;
      const parsed: StoredState = JSON.parse(stored);
      if (parsed.character) this.creation.set(parsed.character as any);
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
