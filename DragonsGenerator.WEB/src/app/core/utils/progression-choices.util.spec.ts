import { subclassBonusProficiencies } from './progression-choices.util';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';

function makeCls(subclasses: unknown): CharacterClass {
  return {
    id: 'cls-pretre',
    name: 'Prêtre',
    data: { subclasses } as any,
  } as unknown as CharacterClass;
}

describe('subclassBonusProficiencies', () => {
  it('returns empty result when no subclassId provided', () => {
    const cls = makeCls({ options: [] });
    expect(subclassBonusProficiencies(cls, null)).toEqual({
      armor: [],
      weapons: [],
      skills: [],
      expertise: [],
    });
  });

  it('extracts armor + skills bonus from a matching subclass (Domaine de la Force)', () => {
    const cls = makeCls({
      options: [
        {
          id: 'subcls-domaine-de-la-force',
          bonus_proficiencies: {
            weapons: ['category-martial-weapons'],
            skills: ['skill-acrobaties', 'skill-athletisme'],
          },
        },
      ],
    });
    const res = subclassBonusProficiencies(cls, 'subcls-domaine-de-la-force');
    expect(res.weapons).toEqual(['category-martial-weapons']);
    expect(res.skills).toEqual(['skill-acrobaties', 'skill-athletisme']);
    expect(res.armor).toEqual([]);
    expect(res.expertise).toEqual([]);
  });

  it('extracts armor bonus from Domaine de la Vie', () => {
    const cls = makeCls({
      options: [
        {
          id: 'subcls-domaine-de-la-vie',
          bonus_proficiencies: { armor: ['category-heavy-armor'] },
        },
      ],
    });
    expect(subclassBonusProficiencies(cls, 'subcls-domaine-de-la-vie').armor).toEqual([
      'category-heavy-armor',
    ]);
  });

  it('extracts fixed expertise from Domaine du Partage', () => {
    const cls = makeCls({
      options: [
        {
          id: 'subcls-domaine-du-partage',
          bonus_proficiencies: {
            skills: ['skill-persuasion'],
            expertise: ['skill-persuasion'],
          },
        },
      ],
    });
    const res = subclassBonusProficiencies(cls, 'subcls-domaine-du-partage');
    expect(res.skills).toEqual(['skill-persuasion']);
    expect(res.expertise).toEqual(['skill-persuasion']);
  });

  it('returns empty result for a subclass without bonus_proficiencies', () => {
    const cls = makeCls({ options: [{ id: 'subcls-other' }] });
    expect(subclassBonusProficiencies(cls, 'subcls-other')).toEqual({
      armor: [],
      weapons: [],
      skills: [],
      expertise: [],
    });
  });

  it('returns empty result when subclass id is not found', () => {
    const cls = makeCls({ options: [{ id: 'subcls-other' }] });
    expect(subclassBonusProficiencies(cls, 'subcls-unknown')).toEqual({
      armor: [],
      weapons: [],
      skills: [],
      expertise: [],
    });
  });
});
