import type { Ability } from '../CharacterClasses/character-class';
import type { AbilityScores, AsiChoiceSlot } from './character-ability';
import type { CatalogRef, ClassRef, Size, SpeciesRef } from './character-refs';
import type { FeatureInstance } from './character-features';
import type {
  Ammunition,
  Attack,
  CarryCapacity,
  CharacterProficiencies,
  Currency,
  Defense,
  EquipmentInstance,
  Movement,
  Senses,
  Vitality,
} from './character-sheet';
import type { CharacterSpellcasting, SpellcastingKind, SpellInstance } from './character-spellcasting';
import type { Personality } from './character-personality';

// =============================================================================
// PERSONNAGE COMPLET
// =============================================================================

export interface Character {
  // === Méta ===
  id: string;
  /** true si le personnage est enregistré sur le serveur (id cloud valide). */
  cloudSynced?: boolean;
  /**
   * Fiche du pool pré-tirés campagne (MJ) — hors « Mes héros », hors plafond 10.
   * « Copier dans Mes héros » crée une copie sans ce flag.
   */
  isPregenPool?: boolean;
  createdAt: string; // ISO 8601
  updatedAt: string;
  schemaVersion: number;

  // === Identité ===
  name: string;
  /** Portrait / photo (data-URL ou https) — optionnel, PDF page 1. */
  portraitImageUrl?: string | null;
  /** Jeton de table (carré) — optionnel, réutilisable en combat. */
  tokenImageUrl?: string | null;
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
  /** Ressources de progression (points d'astuce, rage, ki, points arcaniques…). */
  classResources?: Record<string, number>;

  // === Page 1 - divers ===
  ammunition: Ammunition[];
  notes: string;

  // === Roleplay ===
  personality: Personality;

  // === Réédition (montée de niveau) ===
  /**
   * Réponses brutes aux choix de progression de classe/sous-classe (ancêtre draconique, domaine,
   * métamagie, invocations…), persistées pour permettre une réédition fiable à un niveau supérieur
   * sans perdre les choix précédents.
   */
  classChoiceAnswers?: Record<string, string[]>;
  /** Slots ASI/dons choisis (niveaux 4, 8, 12…), persistés pour la réédition. */
  asiChoices?: AsiChoiceSlot[];
  /** Snapshot wizard : scores AVANT bonus raciaux/ASI, pour une réédition sans double application. */
  wizardAbilitySnapshot?: {
    baseAbilities: AbilityScores;
    racialBonuses: Partial<AbilityScores>;
  };
  /**
   * Classes secondaires telles que le wizard les a saisies (maîtrises réduites, features, magie).
   * Absent des anciens exports : la réédition les reconstruit depuis le catalogue de classes.
   */
  secondaryClassSelections?: {
    classId: string;
    className: string;
    subclassId?: string | null;
    subclassName?: string | null;
    level: number;
    hitDie: number;
    hpPerLevelAverage: number;
    hasSpellcasting: boolean;
    spellcastingKind: SpellcastingKind | null;
    spellcastingAbility: Ability | null;
    armorProficiencies: string[];
    weaponProficiencies: string[];
    toolProficiencies: string[];
    skillChooseCount: number;
    skillOptions: string[];
    classFeatures: FeatureInstance[];
    classChoiceAnswers?: Record<string, string[]>;
    pactBoon?: string | null;
    eldritchInvocations?: string[];
    metamagicOptions?: string[];
  }[];
}
