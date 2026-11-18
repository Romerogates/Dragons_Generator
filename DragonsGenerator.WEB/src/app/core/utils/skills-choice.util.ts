import type { BackgroundToolRef } from '@core/models/Backgrounds/background';

type RawToolOption =
  | string
  | BackgroundToolRef
  | {
      type?: string;
      id?: string;
      any?: boolean;
      category?: string;
    };

/** Normalise une option d’outil d’historique (API camelCase / snake_case / id catalogue). */
export function normalizeBackgroundToolOption(opt: unknown): BackgroundToolRef {
  if (typeof opt === 'string') {
    const id = opt.toLowerCase();
    if (id === 'tool' || id === 'artisan') return { type: 'tool', any: true };
    if (id === 'instrument') return { type: 'instrument', any: true };
    if (id === 'game_set' || id === 'gameset' || id === 'jeu') return { type: 'gameSet', any: true };
    if (id === 'vehicle' || id === 'vehicule') return { type: 'vehicle', any: true };
    if (id === 'tl-outils-dalchimiste') return { type: 'tool', id: 'tl-necessaire-dalchimiste' };
    if (id.startsWith('tl-') || id.startsWith('vhc-')) {
      return { type: 'tool', id: opt, any: false };
    }
    return { type: 'tool', id: opt, any: false };
  }

  if (!opt || typeof opt !== 'object') {
    return { type: 'tool', any: true };
  }

  const raw = opt as RawToolOption & object;

  if (
    'any' in raw &&
    raw.any === true &&
    'type' in raw &&
    typeof raw.type === 'string' &&
    (raw.type === 'tool' ||
      raw.type === 'instrument' ||
      raw.type === 'gameSet' ||
      raw.type === 'vehicle') &&
    !('id' in raw && raw.id)
  ) {
    return { type: raw.type, any: true };
  }
  if ('type' in raw && raw.type === 'tool_category') {
    const cat = String(
      ('category' in raw ? raw.category : undefined) ?? ('id' in raw ? raw.id : undefined) ?? '',
    ).toLowerCase();
    if (cat.includes('instrument')) return { type: 'instrument', any: true };
    if (cat.includes('game') || cat === 'jeu') return { type: 'gameSet', any: true };
    if (cat.includes('vehic')) return { type: 'vehicle', any: true };
    return { type: 'tool', any: true };
  }
  if (
    'type' in raw &&
    (raw.type === 'tool' ||
      raw.type === 'instrument' ||
      raw.type === 'gameSet' ||
      raw.type === 'vehicle')
  ) {
    const oid = String(('id' in raw ? raw.id : undefined) ?? '');
    if (!oid || oid.startsWith('tl-vehicules') || oid === 'tl-materiel-de-jeu' || oid.includes('category')) {
      return { type: raw.type, any: true };
    }
    if (oid === 'tl-outils-dalchimiste') {
      return { type: 'tool', id: 'tl-necessaire-dalchimiste', any: false };
    }
    return { type: raw.type, id: oid, any: false };
  }
  if ('id' in raw && raw.id) {
    const oid = String(raw.id);
    if (oid === 'tl-outils-dalchimiste') {
      return { type: 'tool', id: 'tl-necessaire-dalchimiste', any: false };
    }
    if (oid.startsWith('tl-vehicules') || oid === 'tl-materiel-de-jeu') {
      return oid.includes('jeu') ? { type: 'gameSet', any: true } : { type: 'vehicle', any: true };
    }
    return { type: 'tool', id: oid, any: false };
  }
  return { type: 'tool', any: true };
}

export function toggleSkillIdInList(
  current: string[],
  skillId: string,
  max: number,
  blocked: Set<string> = new Set(),
  takenElsewhere: string[] = [],
): string[] {
  const id = skillId;
  if (blocked.has(id)) return current;
  if (current.includes(id)) return current.filter((x) => x !== id);
  if (current.length >= max || takenElsewhere.includes(id)) return current;
  return [...current, id];
}

export function backgroundToolCategoryGroupLabel(category: string): string | null {
  const map: Record<string, string> = {
    instrument: 'Instruments de musique',
    gameSet: 'Matériel de jeu',
    game_set: 'Matériel de jeu',
    vehicle: 'Véhicules',
    vehicule: 'Véhicules',
    tool: "Outils d'artisan",
    artisan: "Outils d'artisan",
  };
  return map[category] ?? null;
}
