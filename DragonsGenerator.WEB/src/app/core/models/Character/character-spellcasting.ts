import type { Ability } from '../CharacterClasses/character-class';

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
  /** Magie de pacte (Occultiste), y compris en multiclasse avec un autre lanceur. */
  pactSlots?: SpellSlotPool[];
  /** Faveur du pacte — aussi si le sorcier est une classe secondaire. */
  pact?: string;
  eldritchInvocations?: string[];
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
  /** Maîtrise des sorts (L17) : 1 sort niv.1 + 1 sort niv.2 à volonté. */
  spellMastery: { spellLevel: number; spellId: string; spellName: string }[];
  /** Sorts attitrés (L19) : 2 sorts niv.3 toujours préparés, 1× / repos court ou long chacun. */
  signatureSpells: { spellId: string; spellName: string }[];
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
  eldritchInvocations: string[]; // Manifestations occultes (noms affichés)
  /** Arcanes : un sort de haut niveau par palier (1× / repos long). */
  mysticArcanum: { spellLevel: number; spellId: string; spellName: string }[];
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
