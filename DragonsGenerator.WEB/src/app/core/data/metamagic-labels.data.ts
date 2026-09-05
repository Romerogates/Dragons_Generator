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

const LABEL_TO_ID = Object.fromEntries(
  Object.entries(METAMAGIC_LABELS).map(([id, label]) => [label.toLowerCase(), id]),
);

export function metamagicLabel(id: string): string {
  if (!id) return '';
  if (METAMAGIC_LABELS[id]) return METAMAGIC_LABELS[id];
  // Déjà un libellé FR (réédition / ancien snapshot)
  if (LABEL_TO_ID[id.toLowerCase()]) return id;
  if (id.startsWith('meta-')) {
    return id
      .replace(/^meta-/, '')
      .replace(/^sort-/, 'Sort ')
      .replace(/-/g, ' ');
  }
  return id;
}

/** Inverse libellé → id (pour réédition). Passe les ids inchangés. */
export function metamagicIdFromLabel(value: string): string {
  if (!value) return value;
  if (METAMAGIC_LABELS[value]) return value;
  return LABEL_TO_ID[value.toLowerCase()] ?? value;
}
