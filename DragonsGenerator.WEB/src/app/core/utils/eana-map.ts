/** Native Carte.jpg size — pins are % of the full uncropped map. */
export const EANA_MAP_ASPECT = '1500 / 1061';
export const EANA_MAP_RATIO = 1500 / 1061;

/**
 * Pin positions as percentages of Carte.jpg (full frame, not object-cover crop).
 * Calibrated against map labels by user.
 */
export const EANA_MAP_COORDS: Record<string, { x: number; y: number }> = {
  'civ-septentrion': { x: 55.9, y: 12.2 },
  'civ-ellerina': { x: 15.8, y: 28.2 },
  'civ-lothrienne': { x: 49.8, y: 21.4 },
  'civ-drakenbergen': { x: 54.1, y: 30.8 },
  'civ-arolavie': { x: 64.7, y: 22.6 },
  'civ-iles-eoliennes': { x: 22.4, y: 41.1 },
  'civ-kaan': { x: 76.5, y: 40.6 },
  'civ-inframonde': { x: 9.8, y: 13 },
  'civ-cite-franche': { x: 45.3, y: 43.9 },
  'civ-cyrillane': { x: 56, y: 39 },
  'civ-iles-barbaresques': { x: 28.1, y: 56.1 },
  'civ-acoatl': { x: 14.3, y: 69.3 },
  'civ-royaumes-des-sables': { x: 55.6, y: 58 },
  'civ-ajagar': { x: 78.6, y: 62.3 },
  'civ-mibu': { x: 52.5, y: 71 },
  'civ-torea': { x: 20.1, y: 85.8 },
  'civ-rachamangekr': { x: 63.4, y: 82.4 },
  'civ-shi-huang': { x: 93.1, y: 80.8 },
};

export const UNKNOWN_REGION_LABEL = 'Région inconnue';

export function getEanaMapCoordinates(id: string): { x: number; y: number } {
  return EANA_MAP_COORDS[id] ?? { x: 50, y: 50 };
}
