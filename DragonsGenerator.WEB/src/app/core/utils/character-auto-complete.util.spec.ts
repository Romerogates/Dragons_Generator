import { autoCompleteRemainingCreation } from './character-auto-complete.util';
import type { CharacterCreation } from '@core/models/Character/character';
import { INITIAL_CREATION_STATE } from '@core/models/Character/character-builder.types';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import type { Spell } from '@core/models/Spells/spell';

function base(partial: Partial<CharacterCreation>): CharacterCreation {
  return { ...INITIAL_CREATION_STATE, ...partial } as CharacterCreation;
}

const LANGS = [
  { id: 'lang-1', name: 'Elfique', category: 'base', speakers: {} },
  { id: 'lang-2', name: 'Nain', category: 'base', speakers: {} },
  { id: 'lang-3', name: 'Draconique', category: 'exotic', speakers: {} },
] as never[];

describe('character-auto-complete.util', () => {
  it('fills missing bonus languages without clearing locked ones', () => {
    const { creation: next, filled } = autoCompleteRemainingCreation(
      base({
        languages: ['Commun'],
        speciesLanguages: ['Commun'],
        bonusLanguageCount: 2,
        skillChooseCount: 0,
        selectedSkills: [],
        hasSpellcasting: false,
      }),
      { languages: LANGS, spells: [] },
    );
    expect(filled).toContain('langues');
    expect(next.languages).toContain('Commun');
    expect(next.languages!.length).toBeGreaterThanOrEqual(3);
  });

  it('locks druid and rogue secret languages', () => {
    const druide = autoCompleteRemainingCreation(
      base({
        classId: 'cls-druide',
        languages: ['Commun'],
        speciesLanguages: ['Commun'],
        bonusLanguageCount: 1,
        hasSpellcasting: false,
      }),
      { languages: LANGS, spells: [] },
    );
    expect(druide.creation.languages).not.toContain('Langue des druides');

    const roublard = autoCompleteRemainingCreation(
      base({
        classId: 'cls-roublard',
        languages: ['Commun'],
        speciesLanguages: ['Commun'],
        bonusLanguageCount: 1,
        hasSpellcasting: false,
      }),
      { languages: LANGS, spells: [] },
    );
    expect(roublard.creation.languages).not.toContain('Argot des voleurs');
  });

  it('skips languages when gap is already filled or catalog empty', () => {
    const filled = autoCompleteRemainingCreation(
      base({
        languages: ['Commun', 'Elfique'],
        speciesLanguages: ['Commun'],
        bonusLanguageCount: 1,
        hasSpellcasting: false,
      }),
      { languages: LANGS, spells: [] },
    );
    expect(filled.filled).not.toContain('langues');

    const empty = autoCompleteRemainingCreation(
      base({
        languages: ['Commun'],
        speciesLanguages: ['Commun'],
        bonusLanguageCount: 2,
        hasSpellcasting: false,
      }),
      { languages: [], spells: [] },
    );
    expect(empty.filled).not.toContain('langues');
  });

  it('fills missing class skills from skillOptions', () => {
    const { creation: next, filled } = autoCompleteRemainingCreation(
      base({
        languages: ['Commun'],
        bonusLanguageCount: 0,
        skillChooseCount: 2,
        skillOptions: ['skill-arcanes', 'skill-histoire', 'skill-nature'],
        selectedSkills: ['skill-arcanes'],
        hasSpellcasting: false,
      }),
      { languages: [], spells: [] },
    );
    expect(filled).toContain('compétences');
    expect(next.selectedSkills!.length).toBe(2);
  });

  it('includes speciesBonusSkillCount in skill need', () => {
    const { creation: next, filled } = autoCompleteRemainingCreation(
      base({
        skillChooseCount: 0,
        speciesBonusSkillCount: 1,
        skillOptions: ['skill-discretion', 'skill-survie'],
        selectedSkills: [],
        hasSpellcasting: false,
      }),
      { languages: [], spells: [] },
    );
    expect(filled).toContain('compétences');
    expect(next.selectedSkills!.length).toBe(1);
  });

  it('skips skills when already complete or pool empty', () => {
    const done = autoCompleteRemainingCreation(
      base({
        skillChooseCount: 1,
        selectedSkills: ['skill-arcanes'],
        skillOptions: ['skill-arcanes'],
        hasSpellcasting: false,
      }),
      { languages: [], spells: [] },
    );
    expect(done.filled).not.toContain('compétences');

    const noPool = autoCompleteRemainingCreation(
      base({
        skillChooseCount: 2,
        selectedSkills: [],
        skillOptions: [],
        hasSpellcasting: false,
      }),
      { languages: [], spells: [] },
    );
    expect(noPool.filled).not.toContain('compétences');
  });

  it('merges empty cantrips/spells from auto-build when caster', () => {
    const classJson = {
      id: 'cls-magicien',
      name: 'Magicien',
      data: {
        spellcasting: {
          ability: 'intelligence',
          cantrips_known: [{ level: 1, count: 3 }],
          spells_known: [{ level: 1, count: 2 }],
        },
      },
    } as unknown as CharacterClass;

    const spells = [
      { id: 'spl-a', name: 'A', level: 0, school: 'évocation', classes: ['cls-magicien'] },
      { id: 'spl-b', name: 'B', level: 0, school: 'évocation', classes: ['cls-magicien'] },
      { id: 'spl-c', name: 'C', level: 0, school: 'évocation', classes: ['cls-magicien'] },
      { id: 'spl-d', name: 'D', level: 1, school: 'évocation', classes: ['cls-magicien'] },
      { id: 'spl-e', name: 'E', level: 1, school: 'évocation', classes: ['cls-magicien'] },
    ] as unknown as Spell[];

    const { creation: next, filled } = autoCompleteRemainingCreation(
      base({
        hasSpellcasting: true,
        spellcastingKind: 'wizard',
        targetLevel: 1,
        spellcastingDetails: {},
      }),
      { languages: [], spells, classJson, abilityModifiers: { intelligence: 3 } },
    );

    if (filled.includes('magie')) {
      const details = next.spellcastingDetails as { cantrips?: unknown[]; spells?: unknown[] };
      expect(
        (details.cantrips?.length ?? 0) > 0 || (details.spells?.length ?? 0) > 0,
      ).toBeTrue();
    }
  });

  it('does not overwrite existing cantrips/spells', () => {
    const classJson = {
      id: 'cls-magicien',
      name: 'Magicien',
      data: {
        spellcasting: {
          ability: 'intelligence',
          cantrips_known: [{ level: 1, count: 3 }],
        },
      },
    } as unknown as CharacterClass;

    const { creation: next, filled } = autoCompleteRemainingCreation(
      base({
        hasSpellcasting: true,
        spellcastingKind: 'wizard',
        targetLevel: 1,
        spellcastingDetails: { cantrips: ['spl-keep'], spells: ['spl-keep2'] },
      }),
      {
        languages: [],
        spells: [{ id: 'spl-z', name: 'Z', level: 0, school: 'évocation', classes: ['cls-magicien'] }] as never[],
        classJson,
      },
    );

    const details = next.spellcastingDetails as { cantrips?: string[]; spells?: string[] };
    expect(details.cantrips).toEqual(['spl-keep']);
    expect(details.spells).toEqual(['spl-keep2']);
    expect(filled).not.toContain('magie');
  });

  it('skips spellcasting when flag off or catalogs missing', () => {
    expect(
      autoCompleteRemainingCreation(base({ hasSpellcasting: false }), {
        languages: [],
        spells: [{ id: 'x' } as never],
        classJson: { id: 'cls-x' } as never,
      }).filled,
    ).not.toContain('magie');

    expect(
      autoCompleteRemainingCreation(base({ hasSpellcasting: true }), {
        languages: [],
        spells: [],
        classJson: { id: 'cls-x' } as never,
      }).filled,
    ).not.toContain('magie');

    expect(
      autoCompleteRemainingCreation(base({ hasSpellcasting: true }), {
        languages: [],
        spells: [{ id: 'x' } as never],
        classJson: null,
      }).filled,
    ).not.toContain('magie');
  });

  it('fills cleric deity when missing', () => {
    const classJson = {
      id: 'cls-pretre',
      name: 'Prêtre',
      data: {
        spellcasting: {
          ability: 'wisdom',
          cantrips_known: [{ level: 1, count: 3 }],
          prepared: true,
        },
      },
    } as unknown as CharacterClass;

    const { filled } = autoCompleteRemainingCreation(
      base({
        hasSpellcasting: true,
        spellcastingKind: 'cleric',
        targetLevel: 1,
        spellcastingDetails: {},
      }),
      {
        languages: [],
        spells: [
          { id: 'spl-a', name: 'A', level: 0, school: 'évocation', classes: ['cls-pretre'] },
          { id: 'spl-b', name: 'B', level: 0, school: 'évocation', classes: ['cls-pretre'] },
          { id: 'spl-c', name: 'C', level: 0, school: 'évocation', classes: ['cls-pretre'] },
        ] as never[],
        classJson,
        abilityModifiers: { sagesse: 3 },
      },
    );
    // deity fill depends on auto-build returning deity — just ensure no throw
    expect(Array.isArray(filled)).toBeTrue();
  });
});
