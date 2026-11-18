import { resolveEquipmentRefId } from '@core/utils/equipment.utils';

export interface ToolCatalogEntry {
  id: string;
  name: string;
  type: string;
  subtype: string | null;
}

export interface ToolCatalogGroup {
  label: string;
  icon: string;
  items: ToolCatalogEntry[];
}

const INSTRUMENT_IDS = [
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
];

const GAME_IDS = ['tl-des', 'tl-echecs', 'tl-go', 'tl-jeu-de-cartes', 'tl-osselets'];

const SPECIAL_KIT_IDS = [
  'tl-outils-de-voleur',
  'tl-necessaire-de-deguisement',
  'tl-necessaire-de-faussaire',
  'tl-necessaire-dempoisonneur',
];

/** Jetons de catégorie véhicules → `subtype` catalogue. */
export const VEHICLE_CATEGORY_SUBTYPES: Record<string, string> = {
  'tl-vehicules-terrestres': 'land',
  'tl-vehicules-maritimes': 'water',
  'tl-vehicules-aeriens': 'air',
};

/** Jetons de catégorie d’outils → libellé de groupe catalogue. */
export const TOOL_POOL_GROUP_LABELS: Record<string, string> = {
  'tl-instrument-de-musique': 'Instruments de musique',
  'tl-cat-instrument-musique': 'Instruments de musique',
  'category-musical-instruments': 'Instruments de musique',
  'tl-outils-artisan': "Outils d'artisan",
  'tl-cat-outils-artisan': "Outils d'artisan",
  'category-tools': "Outils d'artisan",
  'tl-materiel-de-jeu': 'Matériel de jeu',
  'tl-category-materiel-de-jeu': 'Matériel de jeu',
  'category-gaming-sets': 'Matériel de jeu',
};

export function groupToolCatalog(catalog: ToolCatalogEntry[]): ToolCatalogGroup[] {
  if (catalog.length === 0) return [];

  const instruments = catalog.filter(
    (t) =>
      t.type === 'TOOL' && (t.subtype === 'instrument' || INSTRUMENT_IDS.includes(t.id)),
  );
  const games = catalog.filter(
    (t) =>
      t.type === 'TOOL' && (t.subtype === 'gaming_set' || GAME_IDS.includes(t.id)),
  );
  const vehicles = catalog.filter((t) => t.type === 'VEHICLE');
  const specialKits = catalog.filter(
    (t) =>
      t.type === 'TOOL' &&
      (t.subtype === 'special_kit' ||
        t.subtype === 'thieves_tools' ||
        SPECIAL_KIT_IDS.includes(t.id)),
  );
  const artisan = catalog.filter((t) => {
    if (t.type !== 'TOOL') return false;
    if (specialKits.some((s) => s.id === t.id)) return false;
    if (t.subtype === 'artisan_tool' || t.subtype === 'artisan_tools') return true;
    if (t.subtype) return false;
    return (
      !instruments.some((i) => i.id === t.id) &&
      !games.some((g) => g.id === t.id) &&
      !specialKits.some((s) => s.id === t.id)
    );
  });

  return [
    { label: "Outils d'artisan", icon: 'fluent-emoji:hammer-and-wrench', items: artisan },
    { label: 'Kits et outils spéciaux', icon: 'fluent-emoji:locked-with-key', items: specialKits },
    { label: 'Instruments de musique', icon: 'fluent-emoji:violin', items: instruments },
    { label: 'Matériel de jeu', icon: 'fluent-emoji:game-die', items: games },
    { label: 'Véhicules', icon: 'fluent-emoji:horse', items: vehicles },
  ].filter((g) => g.items.length > 0);
}

/** Étend jetons abstraits (véhicules, catégories) en ids concrets du catalogue. */
export function expandToolPoolIds(
  poolIds: string[],
  catalog: ToolCatalogEntry[],
  groups: ToolCatalogGroup[],
): Set<string> {
  const expanded = new Set<string>();
  for (const raw of poolIds) {
    const vehicleSubtype = VEHICLE_CATEGORY_SUBTYPES[raw];
    if (vehicleSubtype) {
      catalog
        .filter((t) => t.type === 'VEHICLE' && t.subtype === vehicleSubtype)
        .forEach((t) => expanded.add(t.id));
      continue;
    }
    const groupLabel = TOOL_POOL_GROUP_LABELS[raw];
    if (groupLabel) {
      groups.find((g) => g.label === groupLabel)?.items.forEach((t) => expanded.add(t.id));
      continue;
    }
    expanded.add(resolveEquipmentRefId(raw));
  }
  return expanded;
}

export function filterToolGroupsByPool(
  groups: ToolCatalogGroup[],
  poolIds: Set<string>,
): ToolCatalogGroup[] {
  if (poolIds.size === 0) return groups;
  const filtered = groups
    .map((g) => ({ ...g, items: g.items.filter((t) => poolIds.has(t.id)) }))
    .filter((g) => g.items.length > 0);
  return filtered.length > 0 ? filtered : groups;
}
