/** Libellés FR pour les clés de ressources de progression de classe. */
const RESOURCE_LABELS: Record<string, string> = {
  points_astuce: "Points d'astuce",
  astuces_known: 'Astuces connues',
  cantrips_known: 'Tours de magie',
  spells_known: 'Sorts connus',
  spells_prepared: 'Sorts préparés',
  prepared_spells: 'Sorts préparés',
  known_spells: 'Sorts connus',
  cantrips: 'Tours de magie',
  spell_slots: 'Emplacements de sorts',
  conquete_methodique_effects: 'Conquêtes méthodiques',
  arcane_points: 'Points arcaniques',
  sorcery_points: 'Points arcaniques',
  rage: 'Rages',
  rages: 'Rages',
  rage_count: 'Rages',
  rage_damage_bonus: 'Bonus de dégâts (rage)',
  ki: 'Ki',
  ki_points: 'Points de ki',
  bardic_inspiration: 'Inspiration bardique',
  bardic_inspiration_die: 'Dé d’inspiration',
  chant_reparateur_die: 'Dé de chant réparateur',
  channel_divinity: 'Conduit divin',
  conduit_divin_uses: 'Conduit divin',
  superiority_dice: 'Dés de supériorité',
  superiority_die: 'Dé de supériorité',
  wild_shape: 'Forme sauvage',
  wild_shape_uses: 'Forme sauvage',
  wild_shape_max_cr_decimal: 'FP max (forme sauvage)',
  wild_shape_fly_allowed: 'Vol (forme sauvage)',
  wild_shape_swim_allowed: 'Nage (forme sauvage)',
  wild_shape_unlimited: 'Forme sauvage illimitée',
  lay_on_hands: 'Imposition des mains',
  imposition_pool: 'Réserve d’imposition',
  fougue_count: 'Fougue',
  fougue_max_per_turn: 'Fougue max / tour',
  extra_attacks: 'Attaques supplémentaires',
  sneak_attack: 'Attaque sournoise',
  sneak_attack_dice: 'Dés d’attaque sournoise',
  martial_arts: 'Arts martiaux',
  martial_arts_die: 'Dé d’arts martiaux',
  unarmored_movement: 'Mouvement sans armure',
  unarmored_movement_bonus_m: 'Bonus de mouvement (m)',
  invocations: 'Invocations',
  invocations_known: 'Invocations connues',
  pact_magic: 'Magie de pacte',
  pact_slots_count: 'Emplacements de pacte',
  pact_slot_level: 'Niveau d’emplacement de pacte',
  arcane_recovery: 'Récupération arcanique',
  hit_dice: 'Dés de vie',
  expertise_dice: 'Dés d’expertise',
};

export function classResourceLabel(key: string): string {
  if (RESOURCE_LABELS[key]) return RESOURCE_LABELS[key];
  return key
    .replace(/_/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

/** Ressources utiles à afficher sur la fiche (ignore compteurs internes). */
const HIDDEN_KEYS = new Set([
  'conquete_methodique_effects',
]);

export function isHiddenClassResourceKey(key: string): boolean {
  return HIDDEN_KEYS.has(key);
}

export function visibleClassResources(
  resources: Record<string, number | string | null> | null | undefined,
): { key: string; label: string; value: string }[] {
  if (!resources) return [];
  return Object.entries(resources)
    .filter(([k, v]) => {
      if (HIDDEN_KEYS.has(k)) return false;
      if (typeof v === 'number') return v > 0;
      if (typeof v === 'string') return v.trim().length > 0;
      return false;
    })
    .map(([key, value]) => ({
      key,
      label: classResourceLabel(key),
      value: typeof value === 'number' ? String(value) : String(value),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'));
}
