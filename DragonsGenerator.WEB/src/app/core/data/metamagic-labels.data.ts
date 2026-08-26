/**
 * Libellés français des options de métamagie (ensorceleur).
 * Les IDs restent stockés ; l'affichage fiche/PDF utilise ces noms.
 */
export const METAMAGIC_LABELS: Record<string, string> = {
  'meta-sort-accelere': 'Sort accéléré',
  'meta-sort-allonge': 'Sort allongé',
  'meta-sort-discret': 'Sort discret',
  'meta-sort-etendu': 'Sort étendu',
  'meta-sort-intensifie': 'Sort intensifié',
  'meta-sort-jumeau': 'Sort jumeau',
  'meta-sort-prevenant': 'Sort prévenant',
  'meta-sort-renforce': 'Sort renforcé',
};

export function metamagicLabel(id: string): string {
  if (METAMAGIC_LABELS[id]) return METAMAGIC_LABELS[id];
  return id.replace(/^meta-/, '').replace(/-/g, ' ');
}
