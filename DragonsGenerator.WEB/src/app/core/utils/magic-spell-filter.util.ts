import type { Spell } from '@core/models/Spells/spell';

export type SpellFilterScope = 'cantrip' | 'leveled' | 'racial' | 'arcanum' | 'mastery';
export type SpellTagFilter = 'all' | 'selected' | 'concentration' | 'ritual';

export function normalizeSpellSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function spellSchoolKey(school: string): string {
  return normalizeSpellSearch(school || '');
}

export function filterSpellList(
  spells: Spell[],
  opts: {
    query: string;
    school: string;
    tag: SpellTagFilter;
    scope: SpellFilterScope;
    selectedCantrips: Set<string>;
    selectedSpells: Set<string>;
    racialPicks: Set<string>;
    arcanumPicks: Set<string>;
    masteryPicks: Set<string>;
    signaturePicks: Set<string>;
  },
): Spell[] {
  const q = normalizeSpellSearch(opts.query.trim());
  const school = opts.school;
  const tag = opts.tag;

  return spells.filter((spell) => {
    if (school && spellSchoolKey(spell.school) !== school) return false;
    if (tag === 'concentration' && !spell.isConcentration) return false;
    if (tag === 'ritual' && !spell.isRitual) return false;
    if (tag === 'selected') {
      const selected =
        opts.scope === 'cantrip'
          ? opts.selectedCantrips.has(spell.id)
          : opts.scope === 'leveled'
            ? opts.selectedSpells.has(spell.id)
            : opts.scope === 'racial'
              ? opts.racialPicks.has(spell.id)
              : opts.scope === 'arcanum'
                ? opts.arcanumPicks.has(spell.id)
                : opts.masteryPicks.has(spell.id) ||
                  opts.signaturePicks.has(spell.id) ||
                  opts.selectedSpells.has(spell.id);
      if (!selected) return false;
    }
    if (!q) return true;
    return normalizeSpellSearch(spell.name).includes(q);
  });
}
