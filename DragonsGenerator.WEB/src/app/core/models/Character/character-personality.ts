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
