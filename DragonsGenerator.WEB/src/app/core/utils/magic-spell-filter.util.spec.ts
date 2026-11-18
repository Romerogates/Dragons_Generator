import { filterSpellList, spellSchoolKey } from './magic-spell-filter.util';
import type { Spell } from '@core/models/Spells/spell';

function spell(partial: Partial<Spell> & { id: string; name: string }): Spell {
  return {
    level: 1,
    school: 'Évocation',
    classes: [],
    description: '',
    isConcentration: false,
    isRitual: false,
    ...partial,
  } as Spell;
}

describe('magic-spell-filter.util', () => {
  const base = {
    query: '',
    school: '',
    tag: 'all' as const,
    scope: 'leveled' as const,
    selectedCantrips: new Set<string>(),
    selectedSpells: new Set(['spl-a']),
    racialPicks: new Set<string>(),
    arcanumPicks: new Set<string>(),
    masteryPicks: new Set<string>(),
    signaturePicks: new Set<string>(),
  };

  it('filtre école, recherche et sélection', () => {
    expect(spellSchoolKey('Évocation')).toBe('evocation');
    const list = [
      spell({ id: 'spl-a', name: 'Boule de feu', school: 'Évocation' }),
      spell({ id: 'spl-b', name: 'Invisibilité', school: 'Illusion', isConcentration: true }),
    ];
    expect(filterSpellList(list, { ...base, school: 'illusion' }).map((s) => s.id)).toEqual(['spl-b']);
    expect(filterSpellList(list, { ...base, query: 'boule' }).map((s) => s.id)).toEqual(['spl-a']);
    expect(filterSpellList(list, { ...base, tag: 'selected' }).map((s) => s.id)).toEqual(['spl-a']);
    expect(filterSpellList(list, { ...base, tag: 'concentration' }).map((s) => s.id)).toEqual(['spl-b']);
    const ritual = spell({ id: 'spl-c', name: 'Alarme', school: 'Abjuration', isRitual: true });
    expect(filterSpellList([...list, ritual], { ...base, tag: 'ritual' }).map((s) => s.id)).toEqual(['spl-c']);
    expect(
      filterSpellList(list, {
        ...base,
        scope: 'cantrip',
        tag: 'selected',
        selectedCantrips: new Set(['spl-b']),
      }).map((s) => s.id),
    ).toEqual(['spl-b']);
    expect(
      filterSpellList(list, { ...base, scope: 'racial', tag: 'selected', racialPicks: new Set(['spl-a']) }).map(
        (s) => s.id,
      ),
    ).toEqual(['spl-a']);
    expect(
      filterSpellList(list, { ...base, scope: 'arcanum', tag: 'selected', arcanumPicks: new Set(['spl-a']) }).map(
        (s) => s.id,
      ),
    ).toEqual(['spl-a']);
    expect(
      filterSpellList(list, {
        ...base,
        scope: 'mastery',
        tag: 'selected',
        selectedSpells: new Set(),
        masteryPicks: new Set(['spl-b']),
      }).map((s) => s.id),
    ).toEqual(['spl-b']);
  });
});
