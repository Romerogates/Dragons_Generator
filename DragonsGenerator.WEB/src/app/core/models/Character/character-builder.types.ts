import type {
  Ability,
  AbilityScores,
  CharacterCreation,
  Currency,
  EquipmentInstance,
  EquipmentSlot,
  FeatureInstance,
  Size,
  SpellcastingKind,
} from './character';
import { DEFAULT_ABILITY_SCORE, STARTING_POINTS } from './character';
import type { BackgroundProficiencies } from '../Backgrounds/background';

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
  proficiencies?: BackgroundProficiencies;
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
  /** Parmi les langues bonus, nombre devant être exotiques (ex. Prêtre Domaine du Partage). */
  classRequiredExoticLanguageCount?: number;
  /** Résistances passives accordées par la sous-classe (ex. Druide Cercle des Esprits → psychique). */
  classResistances?: string[];
  /** Vision dans le noir accordée par la classe/sous-classe (ex. Rôdeur Ombre urbaine niv. 7). */
  classDarkvisionRadius?: number;
  /** Vision aveugle accordée par la classe/sous-classe (ex. Rôdeur niv. 18, Roublard niv. 14). */
  classHasBlindsight?: boolean;
  classBlindsightRadius?: number;
  /** Emplacements de sorts au niveau cible (JSON progression). */
  classSpellSlots?: { level: number; max: number }[];
}

export interface IdentitySelection {
  name?: string;
  sex?: 'M' | 'F' | 'X';
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
  backgroundProficiencies?: BackgroundProficiencies | null;
  /** Compteur interne wizard : langues bonus déjà comptées pour l'espèce. */
  speciesBonusLangApplied?: number;
  /** Compteur interne wizard : langues bonus déjà comptées pour l'historique. */
  backgroundBonusLangApplied?: number;
  /** Picks UI de l'étape Équipement (restore au retour arrière). */
  equipmentWizardPicks?: {
    alt: Record<string, number>;
    category: Record<string, string[]>;
  } | null;
  /** Résistances passives accordées par la sous-classe choisie (fusionnées à la fiche). */
  classResistances?: string[];
  /** Vision dans le noir/aveugle accordée par la classe/sous-classe (fusionnées à la fiche). */
  classDarkvisionRadius?: number;
  classHasBlindsight?: boolean;
  classBlindsightRadius?: number;
};

export const INITIAL_CREATION_STATE: ExtendedCharacterCreation = {
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
  classResistances: [],
  classDarkvisionRadius: 0,
  classHasBlindsight: false,
  classBlindsightRadius: 0,
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
  equipmentWizardPicks: null,
  currency: { cuivre: 0, argent: 0, or: 0, platine: 0 },

  languages: [],
  bonusLanguageCount: 0,
  requiredExoticLanguageCount: 0,

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
