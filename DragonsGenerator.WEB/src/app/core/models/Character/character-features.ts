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
