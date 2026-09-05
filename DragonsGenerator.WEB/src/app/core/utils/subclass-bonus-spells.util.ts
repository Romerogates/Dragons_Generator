import type { CharacterClass } from '@core/models/CharacterClasses/character-class';

export interface OathSpellsByLevel {
  characterLevel: number;
  spells: string[];
}

/**
 * Extrait les sorts de serment / domaine / cercle depuis `bonus_spells_granted`
 * de la sous-classe (niveau-gated). `spellNameById` résout les libellés ; sinon IDs.
 */
export function extractSubclassBonusSpells(
  cls: CharacterClass | null | undefined,
  subclassId: string | null | undefined,
  characterLevel: number,
  spellNameById?: Map<string, string> | Record<string, string> | null,
): OathSpellsByLevel[] {
  if (!cls || !subclassId || characterLevel < 1) return [];
  const rawSubs = cls.data?.subclasses as
    | { options?: { id: string; bonus_spells_granted?: { level_unlocked?: number; spells?: string[] }[] }[] }
    | { id: string; bonus_spells_granted?: { level_unlocked?: number; spells?: string[] }[] }[]
    | undefined;
  const options = Array.isArray(rawSubs) ? rawSubs : (rawSubs?.options ?? []);
  const sub = options.find((o) => o.id === subclassId);
  if (!sub?.bonus_spells_granted?.length) return [];

  const resolveName = (id: string): string => {
    if (!spellNameById) return id;
    if (spellNameById instanceof Map) return spellNameById.get(id) ?? id;
    return spellNameById[id] ?? id;
  };

  return sub.bonus_spells_granted
    .filter((g) => (g.level_unlocked ?? 99) <= characterLevel)
    .map((g) => ({
      characterLevel: g.level_unlocked ?? 0,
      spells: (g.spells ?? []).map(resolveName),
    }))
    .filter((g) => g.spells.length > 0);
}
