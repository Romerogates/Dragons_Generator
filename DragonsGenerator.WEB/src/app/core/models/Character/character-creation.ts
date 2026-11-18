import type { Ability, EquipmentSlot } from '../CharacterClasses/character-class';
import type { AbilityScores, AsiChoiceSlot } from './character-ability';
import type { Size } from './character-refs';
import type { FeatureInstance } from './character-features';
import type { Currency, EquipmentInstance } from './character-sheet';
import type { SpellcastingKind } from './character-spellcasting';

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
  /** Answers to species creation choices (e.g. dragon lineage). */
  speciesChoiceAnswers: Record<string, string[]>;
  /** Compétences bonus d'espèce à choisir (Polyvalence, etc.). */
  speciesBonusSkillCount: number;
  /** Outils bonus d'espèce à choisir. */
  speciesBonusToolCount: number;
  /** Pool concret d'ids d'outils dans lequel piocher `speciesBonusToolCount` maîtrises (ex. Nain :
   * nécessaire de brasseur/forgeron/maçon). Vide → l'étape Savoirs retombe sur le catalogue complet. */
  speciesBonusToolPoolIds: string[];
  /** Libellé du choix d'outil d'espèce différé, pour affichage à l'étape Savoirs. */
  speciesBonusToolChoiceLabel: string;
  /** Sorts raciaux à choisir à l'étape Magie (ex. sort mineur de magicien). */
  racialSpellGrants: {
    choiceId: string;
    label: string;
    desc: string;
    pool: string[];
    spellLevel: number;
    spellcastingAbility: string;
  }[];

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
  /** Niveau cible du personnage (1–20). Défaut : 1. */
  targetLevel: number;
  classId: string | null;
  className: string | null;
  subclassId: string | null;
  subclassName: string | null;
  hitDie: number;
  /** PV max au niveau 1 (sans CON), depuis la classe. */
  hpAtLevel1: number;
  /** PV moyens par niveau après le 1 (sans CON). */
  hpPerLevelAverage: number;
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
  /** Ressources de progression au niveau cible (ki, rage, déplacement sans armure…). */
  classProgressionResources: Record<string, number | string | null>;
  /** Réponses aux choix de progression (ennemi, terrain, métamagie, invocations…). */
  classChoiceAnswers: Record<string, string[]>;
  /** Langues supplémentaires de classe (ex. Lettré ×3). */
  classBonusLanguageCount: number;
  /** Emplacements de sorts issus de la progression JSON. */
  classSpellSlots: { level: number; max: number }[];
  /** Bonus ASI (niv. 4+) appliqués après le point-buy — somme de tous les slots. */
  asiBonuses: Partial<AbilityScores>;
  /** Don choisi à la place d'un ASI (compat : premier don). */
  selectedFeatId: string | null;
  /** Tous les dons choisis à la place d'ASI (multi-slots niv. 6–20). */
  selectedFeatIds: string[];
  /** Détail des choix ASI (un par palier). */
  asiChoices: AsiChoiceSlot[];
  /** Compétences en expertise (roublard, barde, lettré…). */
  expertiseSkills: string[];
  /** Options de métamagie choisies. */
  metamagicOptions: string[];
  /** Manifestations occultes (sorcier). */
  eldritchInvocations: string[];
  /** Faveur du pacte (sorcier). */
  pactBoon: string | null;
  /** Arcanes sorcier : clé = niveau de sort (6–9), valeur = id du sort. */
  mysticArcanumPicks: Record<string, string>;
  /** Magicien L17 : clé = niveau de sort (1|2), valeur = id. */
  spellMasteryPicks: Record<string, string>;
  /** Magicien L19 : deux sorts de niveau 3. */
  signatureSpellIds: string[];

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
  /** Parmi les langues bonus, nombre devant être exotiques (ex. Prêtre Domaine du Partage). */
  requiredExoticLanguageCount: number;
  /** Parmi les langues bonus, nombre devant être courantes (ex. Barde "Langues communes" ×2). */
  requiredBaseLanguageCount: number;

  // Étape 9 - Identité (anciennement 8)
  name: string;
  sex: 'M' | 'F' | 'X';
  description: string;
  /** Portrait (data-URL JPEG) — optionnel. */
  portraitImageUrl?: string | null;
  /** Jeton de table carré (data-URL) — optionnel. */
  tokenImageUrl?: string | null;
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

export {
  ABILITY_POINT_COSTS,
  DEFAULT_ABILITY_SCORE,
  MAX_ABILITY_SCORE,
  MIN_ABILITY_SCORE,
  STARTING_POINTS,
} from './character-ability';

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
