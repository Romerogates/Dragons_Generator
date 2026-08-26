/** Libellés FR pour les clés de ressources de progression de classe. */
const RESOURCE_LABELS: Record<string, string> = {
  points_astuce: "Points d'astuce",
  astuces_known: 'Astuces connues',
  conquete_methodique_effects: 'Conquêtes méthodiques',
  arcane_points: 'Points arcaniques',
  sorcery_points: 'Points arcaniques',
  rage: 'Rage',
  rages: 'Rage',
  ki: 'Ki',
  ki_points: 'Ki',
  bardic_inspiration: 'Inspiration bardique',
  channel_divinity: 'Conduit divin',
  conduit_divin_uses: 'Conduit divin',
  superiority_dice: 'Dés de supériorité',
  wild_shape: 'Forme sauvage',
  lay_on_hands: 'Imposition des mains',
};

export function classResourceLabel(key: string): string {
  if (RESOURCE_LABELS[key]) return RESOURCE_LABELS[key];
  return key.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

/** Ressources utiles à afficher sur la fiche (ignore compteurs internes). */
const HIDDEN_KEYS = new Set([
  'astuces_known',
  'conquete_methodique_effects',
  'cantrips_known',
  'spells_known',
  'spells_prepared',
]);

export function visibleClassResources(
  resources: Record<string, number> | null | undefined,
): { key: string; label: string; value: number }[] {
  if (!resources) return [];
  return Object.entries(resources)
    .filter(([k, v]) => !HIDDEN_KEYS.has(k) && typeof v === 'number' && v > 0)
    .map(([key, value]) => ({ key, label: classResourceLabel(key), value }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}
