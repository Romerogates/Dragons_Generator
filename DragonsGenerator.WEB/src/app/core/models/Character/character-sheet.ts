import type { Ability } from '../CharacterClasses/character-class';
import type { FeatureRecharge } from './character-features';

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
