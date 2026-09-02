import {
  mergeToolProficiencies,
  mergeWeaponProficiencies,
  normalizeBackgroundSkillId,
  stripProgressionChoiceFeatures,
  toggleSkillSelection,
} from './character-proficiencies.util';

describe('character-proficiencies.util', () => {
  it('normalizeBackgroundSkillId fixes ski- prefix', () => {
    expect(normalizeBackgroundSkillId('ski-perception')).toBe('skill-perception');
    expect(normalizeBackgroundSkillId('skill-arcanes')).toBe('skill-arcanes');
    expect(normalizeBackgroundSkillId('other')).toBe('other');
  });

  it('mergeWeaponProficiencies dedupes', () => {
    expect(mergeWeaponProficiencies(['wp-a'], ['wp-a', 'wp-b'])).toEqual(['wp-a', 'wp-b']);
  });

  it('mergeToolProficiencies dedupes', () => {
    expect(mergeToolProficiencies(['tl-a'], ['tl-a', 'tl-b'])).toEqual(['tl-a', 'tl-b']);
  });

  it('stripProgressionChoiceFeatures removes invoc/meta placeholders', () => {
    const existing = [
      { name: 'Invoc', desc: '', source: 'class' as const, refId: 'invoc-eldritch-blast' },
      { name: 'Style', desc: '', source: 'class' as const, refId: 'style-duel' },
    ];
    const extras = [
      { name: 'Agonizing', desc: '', source: 'class' as const, refId: 'invoc-agonizing' },
    ];
    const kept = stripProgressionChoiceFeatures(existing, extras);
    expect(kept.map((f) => f.refId)).toEqual(['style-duel']);
  });

  it('toggleSkillSelection respects maxCount', () => {
    expect(toggleSkillSelection(['skill-a'], 'skill-b', 2)).toEqual(['skill-a', 'skill-b']);
    expect(toggleSkillSelection(['skill-a', 'skill-b'], 'skill-c', 2)).toEqual([
      'skill-a',
      'skill-b',
    ]);
    expect(toggleSkillSelection(['skill-a'], 'skill-a', 2)).toEqual([]);
  });
});
