// core/services/character-builder.service.ts

import { Injectable, signal, computed, effect } from '@angular/core';
import {
  // Types principaux
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

  // Constantes
  ABILITY_POINT_COSTS,
  STARTING_POINTS,
  DEFAULT_ABILITY_SCORE,
  MIN_ABILITY_SCORE,
  MAX_ABILITY_SCORE,
  CURRENT_SCHEMA_VERSION,
  ABILITY_KEY_TO_LABEL,
  ABILITY_LABEL_TO_KEY,

  // Helpers
  getAbilityModifier,
  formatModifier,
} from '../models/Character/character';

// =============================================================================
// DTOs - interfaces pour les setters (pas de couplage avec les types catalogue)
// =============================================================================
// Les composants d'étape convertissent les données du catalogue en ces DTOs
// avant d'appeler le service. Ça découple le service de l'API.

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

// =============================================================================
// ÉTAT INITIAL
// =============================================================================

const INITIAL_CREATION_STATE: CharacterCreation = {
  // Étape 1 - Espèce
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

  // Étape 2 - Civilisation
  civilizationId: null,
  civilizationName: null,
  civilizationLanguages: [],
  civilizationWritingSystems: [],

  // Étape 3 - Classe
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

  // Étape 4 - Caractéristiques
  baseAbilities: {
    force: DEFAULT_ABILITY_SCORE,
    dexterite: DEFAULT_ABILITY_SCORE,
    constitution: DEFAULT_ABILITY_SCORE,
    intelligence: DEFAULT_ABILITY_SCORE,
    sagesse: DEFAULT_ABILITY_SCORE,
    charisme: DEFAULT_ABILITY_SCORE,
  },
  pointsRemaining: STARTING_POINTS,

  // Étape 5 - Compétences
  selectedSkills: [],

  // Étape 6 - Équipement
  selectedEquipment: [],
  currency: { cuivre: 0, argent: 0, or: 0, platine: 0 },

  // Étape 7 - Langues
  languages: [],
  bonusLanguageCount: 0,

  // Étape 8 - Identité
  name: '',
  description: '',
  background: '',
  alignment: '',
  traits: '',
  ideal: '',
  bonds: '',
  flaws: '',
  handicap: '',
  story: '',

  // Étape 9 - Magie (conditionnel)
  spellcastingDetails: {},
};

// =============================================================================
// PERSISTENCE
// =============================================================================

const STORAGE_KEY = 'dragon_character_builder_v2';

interface StoredState {
  character: CharacterCreation;
  step: number;
  editing: EditingRef | null;
}

interface EditingRef {
  id: string;
  createdAt: string;
}

// =============================================================================
// SERVICE
// =============================================================================

@Injectable({ providedIn: 'root' })
export class CharacterBuilderService {
  // =========================================================================
  // STATE
  // =========================================================================

  /** État brut du personnage en cours de création. */
  readonly creation = signal<CharacterCreation>(structuredClone(INITIAL_CREATION_STATE));

  /** Étape courante (1-indexed). */
  readonly currentStep = signal<number>(1);

  /** Référence au personnage en cours d'édition (null = création neuve). */
  private readonly editingRef = signal<EditingRef | null>(null);

  constructor() {
    this.loadFromStorage();

    // Sauvegarde automatique à chaque changement
    effect(() => {
      const data: StoredState = {
        character: this.creation(),
        step: this.currentStep(),
        editing: this.editingRef(),
      };
      this.saveToStorage(data);
    });
  }

  // =========================================================================
  // COMPUTED - Dérivées réactives
  // =========================================================================

  /** Liste des étapes (dynamique : l'étape magie n'apparaît que si la classe lance des sorts). */
  readonly steps = computed(() => {
    const base = [
      { number: 1, title: 'Espèce', icon: '🧬' },
      { number: 2, title: 'Civilisation', icon: '🏰' },
      { number: 3, title: 'Classe', icon: '⚔️' },
      { number: 4, title: 'Caractéristiques', icon: '📊' },
      { number: 5, title: 'Compétences', icon: '🎯' },
      { number: 6, title: 'Équipement', icon: '🎒' },
      { number: 7, title: 'Langues', icon: '🗣️' },
    ];

    if (this.creation().hasSpellcasting) {
      base.push({ number: 8, title: 'Magie', icon: '✨' });
      base.push({ number: 9, title: 'Identité', icon: '📜' });
      base.push({ number: 10, title: 'Récapitulatif', icon: '✅' });
    } else {
      base.push({ number: 8, title: 'Identité', icon: '📜' });
      base.push({ number: 9, title: 'Récapitulatif', icon: '✅' });
    }

    return base;
  });

  /** Nombre total d'étapes. */
  readonly totalSteps = computed(() => this.steps().length);

  /** Numéro de l'étape récapitulative (9 ou 10 selon la classe). */
  readonly summaryStep = computed(() => this.totalSteps());

  /** Scores finaux = base + bonus raciaux. */
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

  /** Modificateurs dérivés des scores finaux. */
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

  /** PV max au niveau 1 = dé de vie max + mod Constitution. */
  readonly hitPointsMax = computed<number>(() => {
    return this.creation().hitDie + this.abilityModifiers().constitution;
  });

  /** Seuil de blessure = moitié des PV max, arrondi au supérieur. */
  readonly woundThreshold = computed<number>(() => {
    return Math.ceil(this.hitPointsMax() / 2);
  });

  /** CA de base (sans armure) = 10 + mod Dextérité. */
  readonly baseArmorClass = computed<number>(() => {
    return 10 + this.abilityModifiers().dexterite;
  });

  /** Initiative = mod Dextérité. */
  readonly initiative = computed<number>(() => {
    return this.abilityModifiers().dexterite;
  });

  /** Perception passive = 10 + mod Sagesse + maîtrise si Perception sélectionnée. */
  readonly passivePerception = computed<number>(() => {
    const mods = this.abilityModifiers();
    const hasPerception = this.creation().selectedSkills.includes('Perception');
    return 10 + mods.sagesse + (hasPerception ? 2 : 0);
  });

  /** Validation de l'étape courante. */
  readonly isCurrentStepValid = computed<boolean>(() => {
    return this.isStepValid(this.currentStep());
  });

  /** Indique s'il y a un brouillon en cours avec de la progression. */
  readonly hasPendingDraft = computed<boolean>(() => {
    const c = this.creation();
    return c.speciesId !== null;
  });

  /** Résumé du brouillon pour l'affichage dans l'overlay. */
  readonly draftSummary = computed<string>(() => {
    const c = this.creation();
    const parts: string[] = [];
    if (c.name) parts.push(c.name);
    if (c.speciesName) parts.push(c.speciesName);
    if (c.className) parts.push(c.className);
    return parts.length > 0 ? parts.join(' · ') : 'Brouillon en cours';
  });

  // =========================================================================
  // VALIDATION PAR ÉTAPE
  // =========================================================================

  isStepValid(step: number): boolean {
    const c = this.creation();
    const summaryNum = this.summaryStep();

    switch (step) {
      case 1:
        return c.speciesId !== null;
      case 2:
        return c.civilizationId !== null;
      case 3:
        return c.classId !== null;
      case 4:
        return c.pointsRemaining >= 0;
      case 5:
        return c.selectedSkills.length === c.skillChooseCount;
      case 6:
        return true; // L'équipement est optionnel (on peut garder le starter)
      case 7:
        return c.languages.length > 0;
      case 8:
        // Magie (si lanceur) ou Identité (sinon)
        if (c.hasSpellcasting) return true; // magie toujours valide pour l'instant
        return c.name.trim().length > 0; // identité

      case 9:
        // Identité (si lanceur) ou Récap (sinon)
        if (c.hasSpellcasting) return c.name.trim().length > 0;
        return true; // récap
      case 10:
        return true; // récapitulatif avec magie
      default:
        return false;
    }
  }

  // =========================================================================
  // ÉTAPE 1 - ESPÈCE
  // =========================================================================

  setSpecies(selection: SpeciesSelection): void {
    this.creation.update((c) => ({
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
      bonusLanguageCount: selection.bonusLanguageCount,
      // Mettre à jour les langues agrégées
      languages: [...new Set([...selection.languages, ...c.civilizationLanguages])],
    }));
  }

  clearSpecies(): void {
    this.creation.update((c) => ({
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
      bonusLanguageCount: 0,
      languages: [...c.civilizationLanguages],
    }));
  }

  // =========================================================================
  // ÉTAPE 2 - CIVILISATION
  // =========================================================================

  setCivilization(selection: CivilizationSelection): void {
    this.creation.update((c) => ({
      ...c,
      civilizationId: selection.civilizationId,
      civilizationName: selection.civilizationName,
      civilizationLanguages: selection.languages,
      civilizationWritingSystems: selection.writingSystems,
      languages: [...new Set([...c.speciesLanguages, ...selection.languages])],
    }));
  }

  clearCivilization(): void {
    this.creation.update((c) => ({
      ...c,
      civilizationId: null,
      civilizationName: null,
      civilizationLanguages: [],
      civilizationWritingSystems: [],
      languages: [...c.speciesLanguages],
    }));
  }

  // =========================================================================
  // ÉTAPE 3 - CLASSE
  // =========================================================================

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
      // Reset des étapes suivantes qui dépendent de la classe
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

  // =========================================================================
  // ÉTAPE 4 - CARACTÉRISTIQUES (Point Buy)
  // =========================================================================

  setAbilityScore(key: AbilityKey, value: number): void {
    if (value < MIN_ABILITY_SCORE || value > MAX_ABILITY_SCORE) return;

    const c = this.creation();
    const currentValue = c.baseAbilities[key];
    const currentCost = ABILITY_POINT_COSTS[currentValue] ?? 0;
    const newCost = ABILITY_POINT_COSTS[value] ?? 0;
    const pointsDiff = currentCost - newCost;

    if (c.pointsRemaining + pointsDiff < 0) return;

    this.creation.update((state) => ({
      ...state,
      baseAbilities: { ...state.baseAbilities, [key]: value },
      pointsRemaining: state.pointsRemaining + pointsDiff,
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

  // =========================================================================
  // ÉTAPE 5 - COMPÉTENCES
  // =========================================================================

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

  // =========================================================================
  // ÉTAPE 6 - ÉQUIPEMENT
  // =========================================================================

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

  // =========================================================================
  // ÉTAPE 7 - LANGUES
  // =========================================================================

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

  // =========================================================================
  // ÉTAPE 8 - IDENTITÉ
  // =========================================================================

  setIdentity(identity: IdentitySelection): void {
    this.creation.update((c) => ({ ...c, ...identity }));
  }

  // =========================================================================
  // ÉTAPE 9 (conditionnel) - MAGIE
  // =========================================================================

  setSpellcastingDetails(details: Record<string, unknown>): void {
    this.creation.update((c) => ({ ...c, spellcastingDetails: details }));
  }

  // =========================================================================
  // NAVIGATION
  // =========================================================================

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

  // =========================================================================
  // MODE ÉDITION
  // =========================================================================

  get isEditMode(): boolean {
    return this.editingRef() !== null;
  }

  get editingCharacterId(): string | null {
    return this.editingRef()?.id ?? null;
  }

  get editingCharacterCreatedAt(): string | null {
    return this.editingRef()?.createdAt ?? null;
  }

  /** Charger un personnage sauvegardé dans le wizard pour édition. */
  loadForEdit(savedCharacter: Character): void {
    this.editingRef.set({
      id: savedCharacter.id,
      createdAt: savedCharacter.createdAt,
    });

    // On reconstruit un CharacterCreation à partir du Character
    // (perd certaines infos calculées, mais garde ce qui est éditable)
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
      description: savedCharacter.personality.description,
      background: savedCharacter.personality.background,
      alignment: savedCharacter.personality.alignment,
      traits: savedCharacter.personality.traits,
      ideal: savedCharacter.personality.ideal,
      bonds: savedCharacter.personality.bonds,
      flaws: savedCharacter.personality.flaws,
      handicap: savedCharacter.personality.handicap,
      story: savedCharacter.personality.story,

      // Reconstruire spellcastingDetails depuis knownSpells
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

    // Aller au récapitulatif
    this.currentStep.set(this.summaryStep());
  }

  /** Vérifier s'il y a un perso à éditer dans le localStorage (navigation depuis /characters). */
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

  // =========================================================================
  // RESET
  // =========================================================================

  reset(): void {
    this.creation.set(structuredClone(INITIAL_CREATION_STATE));
    this.currentStep.set(1);
    this.editingRef.set(null);
    this.clearStorage();
  }

  // =========================================================================
  // BUILD - Transforme CharacterCreation → Character
  // =========================================================================

  build(): Character {
    const c = this.creation();
    const abilities = this.finalAbilities();
    const modifiers = this.abilityModifiers();
    const hpMax = this.hitPointsMax();
    const now = new Date().toISOString();

    // --- Spellcasting ---
    const spellcasting = this.buildSpellcasting(c, modifiers);

    // --- Features agrégées ---
    const features: FeatureInstance[] = [...c.speciesTraits, ...c.classFeatures];

    // --- Attaques (dérivées de l'équipement arme) ---
    const attacks = this.buildAttacks(c.selectedEquipment, modifiers);

    // --- Charge ---
    const totalWeight = c.selectedEquipment.reduce(
      (sum, item) => sum + (item.wKg ?? 0) * item.qty,
      0,
    );
    const maxCarry = abilities.force * 7.5;

    return {
      // Méta
      id: this.editingRef()?.id ?? crypto.randomUUID(),
      createdAt: this.editingRef()?.createdAt ?? now,
      updatedAt: now,
      schemaVersion: CURRENT_SCHEMA_VERSION,

      // Identité
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

      // Caractéristiques
      abilities,
      abilityModifiers: modifiers,
      proficiencyBonus: 2,

      // Combat
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
        armorClass: this.computeArmorClass(c.selectedEquipment, modifiers),
        armorType: this.findEquippedArmorName(c.selectedEquipment),
        hasShield: c.selectedEquipment.some(
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

      // Mouvement / Sens
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

      // Maîtrises
      proficiencies: {
        armor: c.armorProficiencies,
        weapons: c.weaponProficiencies,
        tools: c.toolProficiencies,
        savingThrows: c.savingThrows,
        skills: c.selectedSkills,
        expertiseSkills: [],
        languages: c.languages,
        writingSystems: c.civilizationWritingSystems,
      },
      features,

      // Équipement
      equipment: c.selectedEquipment,
      currency: c.currency,
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

      // Incantation
      spellcasting,
      knownSpells: this.buildKnownSpells(c),

      // Divers
      ammunition: [],
      notes: '',

      // Roleplay
      personality: {
        description: c.description,
        background: c.background,
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

  // =========================================================================
  // BUILD HELPERS (privés)
  // =========================================================================

  /** Construit le bloc spellcasting typé selon le kind. */
  private buildSpellcasting(
    c: CharacterCreation,
    modifiers: AbilityScores,
  ): CharacterSpellcasting | null {
    if (!c.hasSpellcasting || !c.spellcastingKind || !c.spellcastingAbility) return null;

    const abilityKey = ABILITY_LABEL_TO_KEY[c.spellcastingAbility];
    const spellMod = modifiers[abilityKey] ?? 0;
    const details = c.spellcastingDetails as
      | {
          cantrips?: unknown[];
          spells?: unknown[];
        }
      | undefined;

    // Nombre de cantrips choisis
    const cantripCount = Array.isArray(details?.cantrips) ? details.cantrips.length : 0;

    // Emplacements de sorts au niveau 1 par classe
    const LEVEL1_SLOTS: Record<string, { level: number; max: number }[]> = {
      bard: [{ level: 1, max: 2 }],
      wizard: [{ level: 1, max: 2 }],
      sorcerer: [{ level: 1, max: 2 }],
      cleric: [{ level: 1, max: 2 }],
      druid: [{ level: 1, max: 2 }],
      warlock: [{ level: 1, max: 1 }],
      ranger: [{ level: 1, max: 0 }], // Sorts au niv 2
      paladin: [{ level: 1, max: 0 }], // Sorts au niv 2
      fighter_eldritch_knight: [{ level: 1, max: 0 }], // Sorts au niv 3
    };

    // Détecter le focaliseur depuis l'équipement
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

  /** Détecte un focaliseur dans l'équipement sélectionné. */
  private detectFocus(c: CharacterCreation): string | null {
    const INSTRUMENT_KEYWORDS = [
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
    ];
    const ARCANE_FOCUS_KEYWORDS = ['baguette', 'orbe', 'bâton', 'cristal', 'focaliseur'];
    const HOLY_KEYWORDS = ['symbole sacré', 'reliquaire', 'amulette'];
    const DRUID_KEYWORDS = ['totem', 'bâton', 'gui'];

    for (const eq of c.selectedEquipment) {
      const name = eq.name.toLowerCase();
      // Instruments (barde)
      if (INSTRUMENT_KEYWORDS.some((k) => name.includes(k))) return eq.name;
      // Focaliseurs arcaniques (mage, ensorceleur, sorcier)
      if (ARCANE_FOCUS_KEYWORDS.some((k) => name.includes(k))) return eq.name;
      // Symbole sacré (prêtre)
      if (HOLY_KEYWORDS.some((k) => name.includes(k))) return eq.name;
      // Focaliseur druidique
      if (DRUID_KEYWORDS.some((k) => name.includes(k))) return eq.name;
    }
    return null;
  }

  /** Construit knownSpells à partir de spellcastingDetails. */
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

    if (details.cantrips) {
      for (const s of details.cantrips) {
        result.push({
          refId: s.refId,
          name: s.name,
          level: 0,
          prepared: true,
          effectSummary: s.effectSummary,
        });
      }
    }

    if (details.spells) {
      for (const s of details.spells) {
        result.push({
          refId: s.refId,
          name: s.name,
          level: s.level,
          prepared: true,
          effectSummary: s.effectSummary,
        });
      }
    }

    return result;
  }

  /** Dérive les attaques à partir de l'équipement qui a des données d'arme. */
  private buildAttacks(equipment: EquipmentInstance[], modifiers: AbilityScores): Attack[] {
    const profBonus = 2; // Niveau 1

    return equipment
      .filter((eq) => {
        const cd = eq.customData as { isWeapon?: boolean } | undefined;
        return cd?.isWeapon === true;
      })
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

        // Déterminer le modificateur de caractéristique
        let abilityMod: number;
        if (isRanged) {
          abilityMod = modifiers.dexterite;
        } else if (isFinesse) {
          abilityMod = Math.max(modifiers.force, modifiers.dexterite);
        } else {
          abilityMod = modifiers.force;
        }

        // Bonus d'attaque = mod + maîtrise (on suppose maîtrise pour les armes sélectionnées)
        const attackBonus = abilityMod + profBonus;

        // Dégâts = dés + mod
        const dmgMod = abilityMod >= 0 ? `+${abilityMod}` : `${abilityMod}`;
        const damage = `${wd.damage}${dmgMod}`;

        // Portée
        const rangeProp = wd.properties.find(
          (p) => p.toLowerCase().includes('projectile') || p.toLowerCase().includes('lancer'),
        );
        const range = isRanged ? (rangeProp ?? 'Distance') : 'Corps à corps';

        return {
          name: eq.name,
          source: 'weapon' as const,
          refId: eq.refId,
          attackBonus,
          damage,
          damageType: wd.damageType,
          range,
          properties: wd.properties,
        };
      });
  }

  /** Calcule la CA à partir de l'armure équipée. */
  private computeArmorClass(equipment: EquipmentInstance[], modifiers: AbilityScores): number {
    // Par défaut : 10 + Dex. À affiner quand on aura les données d'armure.
    return 10 + modifiers.dexterite;
  }

  /** Trouve le nom de l'armure portée. */
  private findEquippedArmorName(equipment: EquipmentInstance[]): string {
    const armor = equipment.find((e) => e.equipped && e.location === 'equipped');
    // Heuristique simple pour l'instant
    return armor?.name ?? 'Aucune';
  }

  // =========================================================================
  // UTILITAIRES EXPOSÉS
  // =========================================================================

  getModifier(score: number): number {
    return getAbilityModifier(score);
  }

  formatMod(score: number): string {
    return formatModifier(getAbilityModifier(score));
  }

  // =========================================================================
  // PERSISTENCE (localStorage)
  // =========================================================================

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
      if (parsed.character) this.creation.set(parsed.character);
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
}
