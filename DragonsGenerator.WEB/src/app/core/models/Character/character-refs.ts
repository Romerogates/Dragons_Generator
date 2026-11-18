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
