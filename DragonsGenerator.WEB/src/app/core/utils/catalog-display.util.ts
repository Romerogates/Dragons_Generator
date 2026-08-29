import { classResourceLabel } from './class-resource-labels';

/** Libellés lisibles pour le catalogue (classes, équipements, dons…). */

const EXTRA_RESOURCE_LABELS: Record<string, string> = {
  fougue_count: 'Fougue',
  extra_attacks: 'Attaques supplémentaires',
  spell_slots: 'Emplacements de sorts',
  cantrips: 'Tours de magie',
  known_spells: 'Sorts connus',
  prepared_spells: 'Sorts préparés',
  invocations: 'Invocations',
  expertise_dice: 'Dés d’expertise',
  superiority_die: 'Dé de superiorité',
  sneak_attack: 'Attaque sournoise',
  martial_arts: 'Arts martiaux',
  unarmored_movement: 'Mouvement sans armure',
  pact_magic: 'Magie de pacte',
  arcane_recovery: 'Récupération arcanique',
  hit_dice: 'Dés de vie',
};

const FEAT_BENEFIT_TYPE_LABELS: Record<string, string> = {
  speed_bonus: 'Bonus de vitesse',
  free_action: 'Action gratuite',
  ignore_property: 'Ignore une propriété',
  reduced_cost: 'Coût réduit',
  ability_score_increase: 'Augmentation de caractéristique',
  proficiency: 'Maîtrise',
  advantage: 'Avantage',
  resistance: 'Résistance',
  feature: 'Aptitude',
  spell: 'Sort',
  other: 'Effet',
};

export function catalogClassResourceLabel(key: string): string {
  if (EXTRA_RESOURCE_LABELS[key]) return EXTRA_RESOURCE_LABELS[key];
  return classResourceLabel(key);
}

export function featBenefitTypeLabel(type: string): string {
  return FEAT_BENEFIT_TYPE_LABELS[type] ?? humanizeKey(type);
}

export function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatClassResources(
  resources: Record<string, unknown> | null | undefined,
): { label: string; value: string }[] {
  if (!resources) return [];
  return Object.entries(resources)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([key, value]) => ({
      label: catalogClassResourceLabel(key),
      value: formatSimpleValue(value),
    }));
}

export function formatFeatBenefits(data: Record<string, unknown> | null | undefined): {
  title: string;
  detail: string;
}[] {
  if (!data) return [];
  const benefits = data['benefits'];
  if (!Array.isArray(benefits)) return [];

  return benefits.map((raw) => {
    if (typeof raw === 'string') {
      return { title: 'Effet', detail: raw };
    }
    const b = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const type = String(b['type'] ?? 'other');
    const parts: string[] = [];
    if (b['value_m'] != null) parts.push(`+${b['value_m']} m`);
    if (b['value'] != null) parts.push(String(b['value']));
    if (b['activity']) parts.push(String(b['activity']));
    if (b['property']) parts.push(humanizeKey(String(b['property'])));
    if (b['cost_m'] != null) parts.push(`${b['cost_m']} m`);
    if (b['desc']) parts.push(String(b['desc']));
    if (b['description']) parts.push(String(b['description']));
    if (b['ability']) parts.push(String(b['ability']).toUpperCase());
    return {
      title: featBenefitTypeLabel(type),
      detail: parts.filter(Boolean).join(' · ') || '—',
    };
  });
}

export function formatFeatPrerequisites(data: Record<string, unknown> | null | undefined): string[] {
  if (!data) return [];
  const prereqs = data['prerequisites'] ?? data['prerequisite'];
  if (!prereqs) return [];
  if (typeof prereqs === 'string') return [prereqs];
  if (!Array.isArray(prereqs)) return [];
  return prereqs.map((p) => {
    if (typeof p === 'string') return p;
    if (p && typeof p === 'object') {
      const o = p as Record<string, unknown>;
      if (o['desc']) return String(o['desc']);
      if (o['name']) return String(o['name']);
      return formatSimpleValue(o);
    }
    return String(p);
  });
}

export function formatSimpleValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  if (typeof value === 'number' || typeof value === 'string') return String(value);
  if (Array.isArray(value)) return value.map((v) => formatSimpleValue(v)).join(', ');
  try {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${humanizeKey(k)}: ${formatSimpleValue(v)}`)
      .join(' · ');
  } catch {
    return String(value);
  }
}

/** Résout les IDs d'aptitudes (`feat-fougue`) en noms lisibles via features_details. */
export function resolveFeatureNames(
  featureIds: string[] | null | undefined,
  details: { id?: string; name?: string }[] | null | undefined,
): string {
  if (!featureIds?.length) return '';
  const map = new Map((details ?? []).map((d) => [d.id ?? '', d.name ?? '']));
  return featureIds
    .map((id) => map.get(id) || humanizeKey(id.replace(/^feat-/, '')))
    .join(', ');
}
