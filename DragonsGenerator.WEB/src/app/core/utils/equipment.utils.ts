import type { Equipment } from '@core/models/Equipments/equipment';
import type { EquipmentSubtype, EquipmentType } from '@core/models/Equipments/equipment-enums';

/** Alias de catégories d'équipement (IDs classes → filtres wizard). */
export const EQUIPMENT_CATEGORY_ALIASES: Record<string, string> = {
  'wp-cat-martial': 'category-martial-weapons',
  'wp-cat-simple': 'category-simple-weapons',
  'wp-category-simple': 'category-simple-weapons',
  'wp-category-martial': 'category-martial-weapons',
  'wp-simple': 'category-simple-weapons',
  'wp-martial': 'category-martial-weapons',
  'wp-arme-de-guerre': 'category-martial-weapons',
  'wp-arme-de-guerre-cac': 'category-martial-melee-weapons',
  'wp-arme-courante': 'category-simple-weapons',
  'wp-arme-courante-corps-a-corps': 'category-simple-melee-weapons',
  'wp-cat-simple-cac-au-choix': 'category-simple-melee-weapons',
  'wp-simple-melee-category': 'category-simple-melee-weapons',
  'category-arme-courante': 'category-simple-weapons',
  'tl-focaliseur-druidique': 'category-druidic-focus',
  'tl-focaliseur-arcanique': 'category-arcane-focus',
  'tl-symbole-sacre': 'category-holy-symbol',
  'tl-focaliseur-personnel': 'category-arcane-focus',
  'tl-mastered-choice': 'tl-mastered-choice',
  'wp-mastered-choice': 'wp-mastered-choice',
};

/** Alias d'IDs concrets (typos / variantes dans les JSON classes). */
export const EQUIPMENT_ID_ALIASES: Record<string, string> = {
  'gr-sac-d-aventurier': 'gr-sac-daventurier',
  'gr-sac-aventurier': 'gr-sac-daventurier',
  'gr-sac-dexplorateur': 'gr-sac-dexplorateur',
  'gr-sac-explorateur': 'gr-sac-dexplorateur',
  'gr-sac-erudit': 'gr-sac-derudit',
  'gr-carreaux-x20': 'it-carreaux',
  'gr-carreau': 'it-carreaux',
  'ar-cuir': 'ar-armure-de-cuir',
  'tl-sacoche-a-composantes': 'it-sacoche-a-composantes',
  'tl-sacoche-composantes': 'it-sacoche-a-composantes',
  'tl-necessaire-d-herboristerie': 'tl-necessaire-dherboristerie',
  'tl-necessaire-d-alchimiste': 'tl-necessaire-dalchimiste',
  'tl-necessaire-alchimiste': 'tl-necessaire-dalchimiste',
  'tl-necessaire-calligraphe': 'tl-necessaire-de-calligraphe',
  'tl-necessaire-cartographe': 'tl-necessaire-de-cartographe',
  'tl-necessaire-herboristerie': 'tl-necessaire-dherboristerie',
};

export const CATEGORY_FILTERS: Record<
  string,
  { type: string; subtypes?: string[]; ids?: string[]; label: string }
> = {
  'category-simple-weapons': {
    type: 'WEAPON',
    subtypes: ['SIMPLE_MELEE', 'SIMPLE_RANGED'],
    label: 'Arme courante',
  },
  'category-martial-weapons': {
    type: 'WEAPON',
    subtypes: ['MARTIAL_MELEE', 'MARTIAL_RANGED'],
    label: 'Arme de guerre',
  },
  'category-martial-melee-weapons': {
    type: 'WEAPON',
    subtypes: ['MARTIAL_MELEE'],
    label: 'Arme de guerre de corps à corps',
  },
  'category-light-armor': { type: 'ARMOR', subtypes: ['LIGHT'], label: 'Armure légère' },
  'category-medium-armor': { type: 'ARMOR', subtypes: ['MEDIUM'], label: 'Armure intermédiaire' },
  'category-shield': { type: 'ARMOR', subtypes: ['SHIELD'], label: 'Bouclier' },
  'category-musical-instruments': {
    type: 'TOOL',
    ids: [
      'tl-bombarde',
      'tl-cor',
      'tl-cornemuse',
      'tl-dulcimer',
      'tl-flute',
      'tl-flute-de-pan',
      'tl-luth',
      'tl-lyre',
      'tl-tambour',
      'tl-viole',
    ],
    label: 'Instrument de musique',
  },
  'category-gaming-sets': {
    type: 'TOOL',
    ids: ['tl-des', 'tl-echecs', 'tl-go', 'tl-jeu-de-cartes', 'tl-osselets'],
    label: 'Matériel de jeu',
  },
  'category-vehicles': { type: 'VEHICLE', label: 'Véhicule' },
  'category-tools': { type: 'TOOL', label: "Outil d'artisan" },
  'category-simple-melee-weapons': {
    type: 'WEAPON',
    subtypes: ['SIMPLE_MELEE'],
    label: 'Arme courante de corps à corps',
  },
  'category-arcane-focus': {
    type: 'GEAR',
    subtypes: ['ARCANE_FOCUS'],
    label: 'Focaliseur arcanique',
  },
  'category-druidic-focus': {
    type: 'GEAR',
    subtypes: ['DRUIDIC_FOCUS'],
    label: 'Focaliseur druidique',
  },
  'category-holy-symbol': {
    type: 'GEAR',
    subtypes: ['HOLY_SYMBOL'],
    label: 'Symbole sacré',
  },
};

export function resolveEquipmentRefId(id: string): string {
  if (EQUIPMENT_CATEGORY_ALIASES[id]) return EQUIPMENT_CATEGORY_ALIASES[id];
  if (EQUIPMENT_ID_ALIASES[id]) return EQUIPMENT_ID_ALIASES[id];
  return id;
}

export function isEquipmentCategoryId(id: string): boolean {
  const resolved = resolveEquipmentRefId(id);
  return (
    resolved in CATEGORY_FILTERS ||
    resolved.startsWith('category-') ||
    resolved === 'tl-mastered-choice' ||
    resolved === 'wp-mastered-choice'
  );
}

/** Choix d'équipement Lettré : une arme ou un outil déjà maîtrisé. */
export function isMasteredProficiencyChoice(id: string): boolean {
  const resolved = resolveEquipmentRefId(id);
  return resolved === 'tl-mastered-choice' || resolved === 'wp-mastered-choice';
}

export function masteredProficiencyChoiceLabel(id: string): string {
  const resolved = resolveEquipmentRefId(id);
  if (resolved === 'wp-mastered-choice') return 'Arme maîtrisée (au choix)';
  if (resolved === 'tl-mastered-choice') return 'Outil maîtrisé (au choix)';
  return 'Choix';
}

/** Normalise une ref d'item (string | {id,qty}) vers {id, qty}. */
export function normalizeItemRef(raw: unknown): { id: string; qty: number } {
  if (typeof raw === 'string') {
    const xMatch = raw.match(/^(.+)-x(\d+)$/i);
    if (xMatch) {
      return { id: resolveEquipmentRefId(xMatch[1]), qty: parseInt(xMatch[2], 10) };
    }
    return { id: resolveEquipmentRefId(raw), qty: 1 };
  }
  if (raw && typeof raw === 'object') {
    const obj = raw as { id?: string; qty?: number };
    if (obj.id) {
      return { id: resolveEquipmentRefId(obj.id), qty: obj.qty ?? 1 };
    }
  }
  return { id: 'unknown', qty: 1 };
}

export function normalizeEquipmentType(type: string): EquipmentType {
  return type.toUpperCase() as EquipmentType;
}

export function normalizeEquipmentSubtype(subtype: string | null | undefined): EquipmentSubtype | null {
  if (!subtype) return null;
  return subtype.toUpperCase() as EquipmentSubtype;
}

export function normalizeEquipment(item: Equipment): Equipment {
  const raw = (item.data ?? {}) as Record<string, unknown>;
  const data = {
    ...raw,
    dmg_d: (raw['dmg_d'] ?? raw['damage_dice'] ?? null) as string | null,
    dmg_t: (raw['dmg_t'] ?? raw['damage_type'] ?? null) as string | null,
    props: (raw['props'] ?? raw['properties'] ?? []) as string[],
    ac: (raw['ac'] ?? raw['ac_base'] ?? null) as number | null,
    stealth_dis: Boolean(raw['stealth_dis'] ?? raw['stealth_disadvantage'] ?? false),
    desc: (raw['desc'] ?? raw['description'] ?? null) as string | null,
    dex_modifier: raw['dex_modifier'],
    max_dex_bonus: raw['max_dex_bonus'] ?? null,
    str_req: raw['str_req'] ?? raw['str_required'] ?? null,
  };

  return {
    ...item,
    type: normalizeEquipmentType(item.type),
    subtype: normalizeEquipmentSubtype(item.subtype),
    data: data as Equipment['data'],
  };
}

export function normalizeEquipments(items: Equipment[]): Equipment[] {
  return items.map(normalizeEquipment);
}
