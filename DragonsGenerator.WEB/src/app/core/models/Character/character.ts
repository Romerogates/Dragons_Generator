// core/models/Character/character.ts
//
// Modèle complet du personnage joueur.
// Aligné sur l'écosystème existant : Species, CharacterClass, Civilisation,
// Equipment, Spell. Suit le pattern Catalogue + Instance : le personnage
// référence le catalogue par `id` et ne dénormalise que le minimum utile
// pour l'affichage autonome (name) + son état personnel mutable (qty,
// prepared, uses.current...).

// -----------------------------------------------------------------------------
// IMPORTS DU CATALOGUE
// -----------------------------------------------------------------------------
// NB : le path relatif dépend de l'organisation finale de tes dossiers.
// Si ton fichier est dans `core/models/Character/character.ts`, alors
// CharacterClass est à côté dans `core/models/CharacterClass/character-class.ts`
// d'où l'import `../CharacterClass/character-class`. À ajuster si besoin.

import type { Ability, EquipmentSlot } from '../CharacterClasses/character-class';

// Réexport pour que les consommateurs de Character n'aient qu'un seul import à faire
export type { Ability, EquipmentSlot };

// =============================================================================
// ABILITY - deux vues complémentaires
// =============================================================================
// `Ability` (importé) = nom affichable français capitalisé ('Force', 'Dextérité'…)
// `AbilityKey` (local) = clé technique pour indexer AbilityScores ('force', 'dexterite'…)

export type AbilityKey =
  | 'force'
  | 'dexterite'
  | 'constitution'
  | 'intelligence'
  | 'sagesse'
  | 'charisme';

export interface AbilityScores {
  force: number;
  dexterite: number;
  constitution: number;
  intelligence: number;
  sagesse: number;
  charisme: number;
}

export const ABILITY_KEYS: readonly AbilityKey[] = [
  'force',
  'dexterite',
  'constitution',
  'intelligence',
  'sagesse',
  'charisme',
] as const;

export const ABILITY_KEY_TO_LABEL: Record<AbilityKey, Ability> = {
  force: 'Force',
  dexterite: 'Dextérité',
  constitution: 'Constitution',
  intelligence: 'Intelligence',
  sagesse: 'Sagesse',
  charisme: 'Charisme',
};

export const ABILITY_LABEL_TO_KEY: Record<Ability, AbilityKey> = {
  Force: 'force',
  Dextérité: 'dexterite',
  Constitution: 'constitution',
  Intelligence: 'intelligence',
  Sagesse: 'sagesse',
  Charisme: 'charisme',
};

// =============================================================================
// REFS VERS LE CATALOGUE
// =============================================================================

/** Référence minimale vers un objet du catalogue. */
export interface CatalogRef {
  id: string;
  label: string;
}

export interface SpeciesRef extends CatalogRef {
  subspeciesId?: string;
  subspeciesLabel?: string;
}

export interface ClassRef {
  classId: string;
  classLabel: string;
  subclassId?: string;
  subclassLabel?: string;
  level: number;
  hitDie: number; // 6, 8, 10, 12
}

// =============================================================================
// TAILLE
// =============================================================================

export const SIZES = ['T', 'P', 'M', 'G', 'TG', 'Gig'] as const;
export type Size = (typeof SIZES)[number];

// =============================================================================
// FEATURE INSTANCE
// =============================================================================
// Référence un FeatureDetail du catalogue + ajoute la source, le contexte
// de recharge et l'état actuel des utilisations.

export type FeatureSource =
  | 'species'
  | 'subspecies'
  | 'civilization'
  | 'class'
  | 'subclass'
  | 'feat'
  | 'background'
  | 'magic_item'
  | 'custom';

export type FeatureRecharge =
  | 'passive' // Trait permanent (Vision dans le noir, Résistance…)
  | 'unlimited' // Usage illimité
  | 'short_rest' // Regain en repos court
  | 'long_rest' // Regain en repos long
  | 'dawn'
  | 'dusk'
  | 'encounter';

export interface FeatureUses {
  max: number;
  current: number;
  recharge: FeatureRecharge;
}

/** Instance d'une capacité côté personnage. */
export interface FeatureInstance {
  /** ID du FeatureDetail / Trait dans le catalogue, si applicable. */
  refId?: string;
  /** Nom dénormalisé (affichage autonome). */
  name: string;
  /** Description, nommée `desc` pour cohérence avec FeatureDetail / Trait. */
  desc: string;
  source: FeatureSource;
  /** Ex: "Guerrier 3", "Elfe sylvestre", "Bénédiction martiale"… */
  sourceDetail?: string;
  level?: number;
  uses?: FeatureUses;
  /** Données mécaniques spécifiques (cohérent avec Trait.mechanics). */
  mechanics?: unknown;
}

// =============================================================================
// VITALITÉ (Page 1)
// =============================================================================

export interface HitDicePool {
  dieType: number; // d6, d8, d10, d12
  total: number;
  used: number;
}

export interface DeathSaves {
  successes: number; // 0-3 (Réussites)
  failures: number; // 0-3 (Échecs)
}

export interface Vitality {
  hitPointsMax: number;
  hitPointsCurrent: number;
  hitPointsTemporary: number;
  woundThreshold: number; // Seuil de blessure (moitié des PV max arrondi sup.)
  hitDice: HitDicePool[];
  fatigue: number; // 0-6 (6 = Mort, JS contre Mort)
  deathSaves: DeathSaves;
  inspiration: boolean;
}

// =============================================================================
// DÉFENSE
// =============================================================================

export interface Defense {
  armorClass: number;
  armorType: string; // "Aucune", "Cuir clouté", "Cotte de mailles"…
  hasShield: boolean;
  resistances: string[];
  immunities: string[];
  vulnerabilities: string[];
  conditionImmunities: string[];
  harmfulStates: string[]; // États préjudiciables actifs sur la fiche
}

// =============================================================================
// MOUVEMENT & SENS
// =============================================================================

export interface Movement {
  walk: number; // VD en mètres
  climb: number;
  swim: number;
  fly?: number;
  burrow?: number;
  jumpHeight: number;
  jumpLength: number;
  speedNotReducedByHeavyArmor?: boolean;
}

export interface Senses {
  passivePerception: number;
  passiveInvestigation?: number;
  passiveInsight?: number;
  hasDarkvision: boolean;
  darkvisionRadius: number; // en mètres
  hasBlindsight?: boolean;
  blindsightRadius?: number;
  hasTruesight?: boolean;
  truesightRadius?: number;
  hasTremorsense?: boolean;
  tremorsenseRadius?: number;
}

// =============================================================================
// MAÎTRISES - miroir de Proficiencies côté catalogue, mais résolu
// =============================================================================

export interface CharacterProficiencies {
  armor: string[];
  weapons: string[];
  tools: string[];
  savingThrows: Ability[];
  skills: string[];
  expertiseSkills: string[];
  languages: string[];
  writingSystems: string[];
}

// =============================================================================
// ATTAQUES (Page 1)
// =============================================================================

export type AttackSource = 'weapon' | 'spell' | 'feature' | 'natural';

export interface Attack {
  name: string;
  source: AttackSource;
  /** Lien vers l'arme / sort / feature d'origine si applicable. */
  refId?: string;
  attackBonus: number;
  damage: string; // "1d8+3"
  damageType: string; // "tranchant", "feu"…
  range: string; // "Corps à corps", "24/96 m"…
  properties?: string[];
  /** Lien vers la munition consommée (id dans ammunition[]). */
  ammunitionId?: string;
  notes?: string;
}

// =============================================================================
// MUNITIONS (Page 1)
// =============================================================================

export interface Ammunition {
  id: string;
  name: string;
  current: number;
  max: number;
}

// =============================================================================
// ÉQUIPEMENT - INSTANCE (Page 2)
// =============================================================================
// Référence un Equipment du catalogue par `refId`, ajoute l'état personnel.

export type EquipmentLocation =
  | 'equipped' // Porté (armure active, armes dégainées)
  | 'at_hand' // Équipement à portée de main (page 2 - haut)
  | 'backpack' // Au fond du sac (page 2 - bas)
  | 'mount' // Sur la mule, dans les fontes
  | 'stored'; // Stocké ailleurs (coffre, domicile)

export interface EquipmentInstance {
  /** UUID local, pour éditer/supprimer sans ambiguïté quand plusieurs instances du même item coexistent. */
  instanceId: string;
  /** ID dans le catalogue Equipment. */
  refId: string;
  /** Nom dénormalisé (affichage autonome). */
  name: string;
  qty: number;
  location: EquipmentLocation;
  /** Actuellement dégainé / porté activement. */
  equipped: boolean;
  /** Poids unitaire en kg, dénormalisé de Equipment.wKg. */
  wKg: number | null;
  /** Notes de table (inscription sur l'épée, état de l'objet…). */
  notes?: string;

  // === Objets magiques ===
  requiresAttunement?: boolean;
  attuned?: boolean;
  charges?: { max: number; current: number; recharge: FeatureRecharge };

  /** Données custom si l'item n'est pas dans le catalogue, ou surcharge locale. */
  customData?: unknown;
}

// =============================================================================
// MONNAIE & CHARGE (Page 2)
// =============================================================================

export interface Currency {
  cuivre: number; // pc
  argent: number; // pa
  or: number; // po
  platine: number; // pp
}

export interface CarryCapacity {
  currentKg: number;
  maxKg: number; // Force × 7.5 par défaut
  encumberedAtKg: number; // Seuil chargé (VD -3m)
  heavilyEncumberedAtKg: number; // Seuil surchargé (VD -6m, désavantages)
  status: 'normal' | 'encumbered' | 'heavily_encumbered';
}

// =============================================================================
// INCANTATION - BASE COMMUNE
// =============================================================================

export interface SpellSlotPool {
  level: number; // 1-9
  max: number;
  used: number;
}

export interface CantripTracker {
  /** Nombre de sorts mineurs connus (cases dessinées sur le grimoire). */
  max: number;
  /** Cases cochées. */
  used: number;
}

/** Instance d'un sort côté personnage (référence le catalogue Spell). */
export interface SpellInstance {
  /** ID du Spell dans le catalogue. */
  refId: string;
  /** Nom dénormalisé. */
  name: string;
  /** Niveau dénormalisé (nécessaire pour le classement dans les grimoires). */
  level: number;
  prepared: boolean;
  /** Toujours préparé (sorts de domaine, de cercle, de serment). */
  alwaysPrepared?: boolean;
  /** Effet dénormalisé court pour la colonne "Effet" du grimoire. */
  effectSummary?: string;
  /** Page dans le livre source (colonne "Page" du grimoire). */
  pageRef?: string;
  /** Options modulaires choisies (voir Spell.modularOptions). */
  chosenModularOptions?: string[];
}

interface CharacterSpellcastingBase {
  ability: Ability; // Nom capitalisé (cohérent avec le catalogue)
  spellSaveDC: number; // DD Sauvegarde contre sort
  spellAttackBonus: number; // Modificateur d'attaque des sorts
  focus: string | null; // Focaliseur arcanique
  spellSlots: SpellSlotPool[]; // Emplacements de sorts niveaux 1-9
  cantrips: CantripTracker;
}

// =============================================================================
// INCANTATION - UNION DISCRIMINÉE PAR CLASSE
// =============================================================================
// IMPORTANT : on nomme le type union `CharacterSpellcasting` pour éviter
// le conflit avec le type `Spellcasting` de CharacterClass (qui décrit
// *ce que la classe permet*, pas l'état actuel du lanceur).
//
// Chaque classe a son propre grimoire (voir images) avec des champs
// spécifiques. Le champ `kind` est le discriminant : TypeScript saura
// automatiquement que si kind === 'warlock' alors `patron` existe.

// MAGE - Grimoire du Mage
export interface WizardSpellcasting extends CharacterSpellcastingBase {
  kind: 'wizard';
  arcaneTradition: string;
}

// ENSORCELEUR - Grimoire de l'Ensorceleur
export interface SorcererSpellcasting extends CharacterSpellcastingBase {
  kind: 'sorcerer';
  atavism: string;
  sorceryPoints: { max: number; current: number };
  metamagic: string[];
}

// SORCIER - Grimoire du Sorcier
export interface WarlockSpellcasting extends CharacterSpellcastingBase {
  kind: 'warlock';
  patron: string; // Suzerain
  pact: string;
  eldritchInvocations: string[]; // Manifestations occultes
}

// PRÊTRE - Grimoire du Prêtre
export interface DivineChannel {
  id: string;
  name: string;
  desc: string;
  uses: { max: number; current: number };
}

export interface ClericSpellcasting extends CharacterSpellcastingBase {
  kind: 'cleric';
  deity: string;
  domain: string;
  divineChannels: DivineChannel[];
}

// DRUIDE - Grimoire du Druide
export interface DruidSpellcasting extends CharacterSpellcastingBase {
  kind: 'druid';
  druidCircle: string;
  circleSpells: string[];
  mysticTranceAvailable: boolean;
  mysticTranceUsed: boolean;
}

// BARDE - Grimoire du Barde
export interface BardSpellcasting extends CharacterSpellcastingBase {
  kind: 'bard';
  bardicCollege: string;
}

// RÔDEUR - partie du grimoire Guerrier/Rôdeur/Paladin
export interface RangerSpellcasting extends CharacterSpellcastingBase {
  kind: 'ranger';
  knownSpellsCount: number;
}

// PALADIN - partie du grimoire Guerrier/Rôdeur/Paladin
export interface OathSpellsByLevel {
  characterLevel: number; // 3, 5, 9, 13, 17
  spells: string[];
}

export interface PaladinSpellcasting extends CharacterSpellcastingBase {
  kind: 'paladin';
  oath: string;
  oathSpells: OathSpellsByLevel[];
}

// GUERRIER ÉLU ARCANIQUE - partie du grimoire Guerrier/Rôdeur/Paladin
export interface SoulWeapon {
  name: string;
  bondedAbilityModifiers: {
    intelligence: number;
    sagesse: number;
    charisme: number;
  };
  desc?: string;
}

export interface FighterSpellcasting extends CharacterSpellcastingBase {
  kind: 'fighter_eldritch_knight';
  soulWeapon: SoulWeapon;
  magicAbility: Extract<Ability, 'Intelligence' | 'Charisme'>;
}

/**
 * Union discriminée de toutes les formes de spellcasting côté personnage.
 * Nommée `CharacterSpellcasting` pour ne pas entrer en conflit avec le type
 * `Spellcasting` du catalogue (CharacterClass).
 */
export type CharacterSpellcasting =
  | WizardSpellcasting
  | SorcererSpellcasting
  | WarlockSpellcasting
  | ClericSpellcasting
  | DruidSpellcasting
  | BardSpellcasting
  | RangerSpellcasting
  | PaladinSpellcasting
  | FighterSpellcasting;

export type SpellcastingKind = CharacterSpellcasting['kind'];

// =============================================================================
// PERSONNALITÉ / ÂME (Page 4)
// =============================================================================

export interface CorruptionTracker {
  stage1: number; // 0-5 (1er palier)
  stage2: number; // 0-5 (2e palier)
  stage3: number; // 0-5 (3e palier)
  stage4: number; // 0-5 (4e palier)
}

export interface Personality {
  // Colonne de gauche
  description: string; // Description physique / portrait
  sex: 'M' | 'F' | 'X';
  background: string; // Historique
  story: string; // Épopée (texte long, multi-paragraphe)

  // Section droite : Âme
  awakened: boolean; // Éveil (toggle à côté du titre "Âme")
  ideal: string;
  traits: string;
  alignment: string;
  bonds: string; // Obligations
  flaws: string; // Failles
  handicap: string;
  madness: string; // Folies
  corruption: CorruptionTracker;
  backgroundId: string | null; // NOUVEAU - référence structurée vers l'historique
}

// =============================================================================
// PERSONNAGE COMPLET
// =============================================================================

export interface Character {
  // === Méta ===
  id: string;
  createdAt: string; // ISO 8601
  updatedAt: string;
  schemaVersion: number;

  // === Identité ===
  name: string;
  species: SpeciesRef;
  size: Size;
  civilization: CatalogRef;
  backgroundRef: CatalogRef | null;
  privilegeRef: { id: string; name: string; desc: string } | null;
  classes: ClassRef[]; // Tableau pour rester ouvert au multiclassage futur. Longueur 1 au niveau 1.
  totalLevel: number;
  experience: number;

  // === Caractéristiques ===
  abilities: AbilityScores; // Scores finaux (base + bonus + buffs)
  abilityModifiers: AbilityScores;
  proficiencyBonus: number;

  // === Combat ===
  vitality: Vitality;
  defense: Defense;
  initiative: number;
  attacks: Attack[];

  // === Mouvement / Sens ===
  movement: Movement;
  senses: Senses;

  // === Maîtrises & Capacités ===
  proficiencies: CharacterProficiencies;
  /**
   * Toutes les capacités actives : traits raciaux, class features, dons,
   * optional rules, features de sous-classe, pouvoirs de background…
   * Filtrables par `source` et `uses.recharge` pour remplir les colonnes
   * "Usage illimité / Regain repos court / Regain repos long" de la page 3.
   */
  features: FeatureInstance[];

  // === Équipement ===
  equipment: EquipmentInstance[];
  currency: Currency;
  carryCapacity: CarryCapacity;

  // === Incantation ===
  spellcasting: CharacterSpellcasting | null;
  knownSpells: SpellInstance[];

  // === Page 1 - divers ===
  ammunition: Ammunition[];
  notes: string;

  // === Roleplay ===
  personality: Personality;
}

// =============================================================================
// ÉTAT DE CRÉATION - intermédiaire
// =============================================================================

export interface CharacterCreation {
  // Étape 1 - Espèce
  speciesId: string | null;
  speciesName: string | null;
  subspeciesId: string | null;
  subspeciesName: string | null;
  racialBonuses: Partial<AbilityScores>;
  speciesTraits: FeatureInstance[];
  speciesSpeed: number;
  speciesSize: Size;
  speciesLanguages: string[];
  speciesResistances: string[];
  hasDarkvision: boolean;
  darkvisionRadius: number;

  // Étape 2 - Civilisation
  civilizationId: string | null;
  civilizationName: string | null;
  civilizationLanguages: string[];
  civilizationWritingSystems: string[];

  // Étape 3 - Historique (NOUVEAU)
  backgroundId: string | null;
  backgroundName: string | null;
  backgroundPreset: boolean;
  backgroundSkills: string[];
  backgroundTools: string[];
  backgroundLanguages: string[];
  backgroundEquipment: EquipmentInstance[];
  backgroundCurrency: Currency;
  privilegeId: string | null;
  privilegeName: string | null;
  privilegeDesc: string | null;
  selectedHandicaps: string[];
  handicapCompensationType: string | null;

  // Étape 4 - Classe (anciennement 3)
  classId: string | null;
  className: string | null;
  subclassId: string | null;
  subclassName: string | null;
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

  // Étape 5 - Caractéristiques (anciennement 4)
  baseAbilities: AbilityScores;
  pointsRemaining: number;

  // Étape 6 - Compétences (anciennement 5)
  selectedSkills: string[];

  // Étape 7 - Équipement (anciennement 6)
  selectedEquipment: EquipmentInstance[];
  currency: Currency;

  // Étape 8 - Langues (anciennement 7)
  languages: string[];
  bonusLanguageCount: number;

  // Étape 9 - Identité (anciennement 8)
  name: string;
  sex: 'M' | 'F' | 'X';
  description: string;
  background: string; // texte libre (résumé affiché sur la fiche)
  alignment: string;
  traits: string;
  ideal: string;
  bonds: string;
  flaws: string;
  handicap: string;
  story: string;

  // Étape 10 - Magie (conditionnel, anciennement 9)
  spellcastingDetails: Record<string, unknown>;
}

// =============================================================================
// CONSTANTES
// =============================================================================

export const ABILITY_POINT_COSTS: Record<number, number> = {
  6: -3,
  7: -2,
  8: -2,
  9: -1,
  10: 0,
  11: 1,
  12: 2,
  13: 3,
  14: 5,
  15: 7,
};

export const STARTING_POINTS = 15;
export const DEFAULT_ABILITY_SCORE = 10;
export const MIN_ABILITY_SCORE = 6;
export const MAX_ABILITY_SCORE = 15;

export const CURRENT_SCHEMA_VERSION = 1;

export const ALIGNMENTS = [
  'Loyal Bon',
  'Neutre Bon',
  'Chaotique Bon',
  'Loyal Neutre',
  'Neutre',
  'Chaotique Neutre',
  'Loyal Mauvais',
  'Neutre Mauvais',
  'Chaotique Mauvais',
] as const;

export type Alignment = (typeof ALIGNMENTS)[number];

/**
 * Mapping classe → kind de spellcasting.
 * Utilisé à l'étape 3 pour savoir s'il faut afficher l'étape magie
 * et quel grimoire pré-remplir à la génération finale.
 */
export const CLASS_SPELLCASTING_KIND: Record<string, SpellcastingKind | null> = {
  barbare: null,
  barde: 'bard',
  druide: 'druid',
  ensorceleur: 'sorcerer',
  // Guerrier : seule la sous-classe Élu arcanique est lanceuse.
  // À affiner à l'étape 3 en lisant la sous-classe sélectionnée.
  guerrier: null,
  mage: 'wizard',
  moine: null,
  paladin: 'paladin',
  pretre: 'cleric',
  rodeur: 'ranger',
  roublard: null,
  sorcier: 'warlock',
};

// =============================================================================
// HELPERS
// =============================================================================

export function abilityKeyToLabel(key: AbilityKey): Ability {
  return ABILITY_KEY_TO_LABEL[key];
}

export function abilityLabelToKey(label: Ability): AbilityKey {
  return ABILITY_LABEL_TO_KEY[label];
}

export function getAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}
