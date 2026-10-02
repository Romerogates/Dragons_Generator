import { validateCharacterExport } from './character-export-validation.util';
import { magicDetailsComplete } from './character-wizard-validation.util';
import { CURRENT_SCHEMA_VERSION, type Character, type CharacterCreation } from '@core/models/Character/character';
import { INITIAL_CREATION_STATE } from '@core/models/Character/character-builder.types';

const base = INITIAL_CREATION_STATE as CharacterCreation;

describe('P0 coverage — magic quotas + export gates', () => {
  it('magicDetailsComplete enforces warlock mystic arcanum slots', () => {
    const warlock = {
      ...base,
      hasSpellcasting: true,
      spellcastingKind: 'warlock' as const,
      targetLevel: 11,
      spellcastingDetails: {
        cantrips: ['c1', 'c2'],
        spells: ['s1', 's2'],
        mysticArcanum: [],
      },
    };
    expect(magicDetailsComplete(warlock)).toBeFalse();
    expect(
      magicDetailsComplete({
        ...warlock,
        spellcastingDetails: {
          ...warlock.spellcastingDetails,
          mysticArcanum: [{ spellId: 'arc-11' }],
        },
      }),
    ).toBeTrue();
  });

  it('magicDetailsComplete accepts secondary-only caster with cantrips', () => {
    expect(
      magicDetailsComplete({
        ...base,
        hasSpellcasting: false,
        secondaryClasses: [
          {
            classId: 'cls-magicien',
            className: 'Magicien',
            level: 1,
            hitDie: 6,
            hasSpellcasting: true,
            spellcastingKind: 'wizard',
            spellcastingAbility: 'intelligence',
            subclassId: null,
            subclassName: null,
            skillChooseCount: 0,
            skillChoices: [],
            fixedSkills: [],
            features: [],
          },
        ],
        spellcastingDetails: { cantrips: ['c1'], spells: [] },
      } as CharacterCreation),
    ).toBeTrue();
  });

  it('export rejects missing subclass at level 3+', () => {
    const broken = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      name: 'Guerrier L3',
      species: { id: 'spc-humain', label: 'Humain' },
      classes: [{ classId: 'cls-guerrier', classLabel: 'Guerrier', level: 3, hitDie: 10 }],
      totalLevel: 3,
      proficiencies: { weapons: [], tools: [], armor: [], languages: ['Commun'] },
      equipment: [],
    } as unknown as Character;
    const result = validateCharacterExport(broken);
    expect(result.valid).toBeFalse();
    expect(result.errors.some((e) => e.includes('Sous-classe'))).toBeTrue();
  });

  it('export rejects incomplete ASI and wizard spell quotas', () => {
    const broken = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      name: 'Mage',
      species: { id: 'spc-humain', label: 'Humain' },
      classes: [
        {
          classId: 'cls-magicien',
          classLabel: 'Magicien',
          level: 1,
          hitDie: 6,
          subclassId: 'subcls-x',
        },
      ],
      totalLevel: 1,
      asiChoices: [{ level: 4, mode: 'plus2', primary: null, secondary: null, featId: null }],
      spellcasting: { kind: 'wizard', ability: 'intelligence' },
      knownSpells: [{ refId: 'c1', name: 'C', level: 0 }],
      proficiencies: { weapons: [], tools: [], armor: [], languages: ['Commun'] },
      equipment: [],
    } as unknown as Character;
    const result = validateCharacterExport(broken);
    expect(result.valid).toBeFalse();
    expect(result.errors.some((e) => e.includes('ASI'))).toBeTrue();
    expect(result.errors.some((e) => e.includes('Tours de magie') || e.includes('Sorts'))).toBeTrue();
  });

  it('export rejects cleric without deity', () => {
    const broken = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      name: 'Prêtre',
      species: { id: 'spc-humain', label: 'Humain' },
      classes: [
        { classId: 'cls-pretre', classLabel: 'Prêtre', level: 1, hitDie: 8, subclassId: 'subcls-vie' },
      ],
      totalLevel: 1,
      spellcasting: { kind: 'cleric', ability: 'wisdom' },
      knownSpells: [
        { refId: 'c1', name: 'C1', level: 0 },
        { refId: 'c2', name: 'C2', level: 0 },
        { refId: 'c3', name: 'C3', level: 0 },
      ],
      proficiencies: { weapons: [], tools: [], armor: [], languages: ['Commun'] },
      equipment: [],
    } as unknown as Character;
    const result = validateCharacterExport(broken);
    expect(result.valid).toBeFalse();
    expect(result.errors.some((e) => e.includes('Divinité'))).toBeTrue();
  });

  it('export rejects incomplete feat and plus1plus1 ASI', () => {
    const baseChar = {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      name: 'Hero',
      species: { id: 'spc-humain', label: 'Humain' },
      classes: [{ classId: 'cls-guerrier', classLabel: 'Guerrier', level: 1, hitDie: 10 }],
      totalLevel: 1,
      proficiencies: { weapons: [], tools: [], armor: [], languages: ['Commun'] },
      equipment: [],
    };
    expect(
      validateCharacterExport({
        ...baseChar,
        asiChoices: [{ level: 4, mode: 'feat', primary: null, secondary: null, featId: null }],
      } as unknown as Character).errors.some((e) => e.includes('don')),
    ).toBeTrue();
    expect(
      validateCharacterExport({
        ...baseChar,
        asiChoices: [
          { level: 4, mode: 'plus1plus1', primary: 'force', secondary: 'force', featId: null },
        ],
      } as unknown as Character).errors.some((e) => e.includes('+1/+1')),
    ).toBeTrue();
  });

  it('magicDetailsComplete applies cercle-de-la-terre bonus cantrip quota', () => {
    const druide = {
      ...base,
      hasSpellcasting: true,
      spellcastingKind: 'druid' as const,
      subclassId: 'subcls-cercle-de-la-terre',
      spellcastingDetails: { cantrips: ['c1', 'c2'], spells: [] },
    };
    // fallback druide = 2 cantrips + 1 bonus = 3
    expect(magicDetailsComplete(druide)).toBeFalse();
    expect(
      magicDetailsComplete({
        ...druide,
        spellcastingDetails: { cantrips: ['c1', 'c2', 'c3'], spells: [] },
      }),
    ).toBeTrue();
  });
});
