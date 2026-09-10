import type { CharacterCreation } from '@core/models/Character/character';
import { INITIAL_CREATION_STATE } from '@core/models/Character/character-builder.types';
import {
  isWizardStepValid,
  racialSpellsComplete,
} from './character-wizard-validation.util';

const base = INITIAL_CREATION_STATE as CharacterCreation;

describe('character-wizard-validation.util', () => {
  it('racialSpellsComplete requires each grant to be picked', () => {
    const c = {
      ...base,
      racialSpellGrants: [{ choiceId: 'elf-cantrip', label: '', desc: '', pool: [], spellLevel: 0, spellcastingAbility: 'INT' }],
      speciesChoiceAnswers: {},
    };
    expect(racialSpellsComplete(c)).toBeFalse();
    expect(
      racialSpellsComplete({
        ...c,
        speciesChoiceAnswers: { 'elf-cantrip': ['sp-light'] },
      }),
    ).toBeTrue();
    expect(
      racialSpellsComplete({
        ...c,
        speciesChoiceAnswers: { 'elf-cantrip': ['any_wizard_cantrip'] },
      }),
    ).toBeFalse();
  });

  it('isWizardStepValid always accepts the level step (default value always set)', () => {
    expect(isWizardStepValid(1, base, { needsMagicStep: false })).toBeTrue();
    expect(isWizardStepValid(1, { ...base, targetLevel: 12 }, { needsMagicStep: false })).toBeTrue();
  });

  it('isWizardStepValid gates species, class and languages', () => {
    expect(isWizardStepValid(2, base, { needsMagicStep: false })).toBeFalse();
    expect(
      isWizardStepValid(2, { ...base, speciesId: 'sp-humain' }, { needsMagicStep: false }),
    ).toBeTrue();
    expect(isWizardStepValid(5, { ...base, classId: 'cls-guerrier' }, { needsMagicStep: false })).toBeFalse();
    expect(
      isWizardStepValid(
        5,
        { ...base, classId: 'cls-guerrier', hitDie: 10 },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
    expect(isWizardStepValid(7, base, { needsMagicStep: false })).toBeFalse();
    expect(
      isWizardStepValid(
        7,
        {
          ...base,
          classId: 'cls-guerrier',
          skillChooseCount: 2,
          selectedSkills: ['skill-athletisme', 'skill-intimidation'],
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
    expect(
      isWizardStepValid(9, { ...base, languages: ['Commun'] }, { needsMagicStep: false }),
    ).toBeTrue();
  });

  it('isWizardStepValid handles magic step identity vs spellcasting', () => {
    const withMagic = {
      ...base,
      speciesId: 'sp-elf',
      hasSpellcasting: true,
      spellcastingDetails: { cantrips: ['sp-light'] },
      name: 'Aldric',
    };
    expect(isWizardStepValid(10, withMagic, { needsMagicStep: true })).toBeTrue();
    expect(
      isWizardStepValid(10, { ...withMagic, spellcastingDetails: {} }, { needsMagicStep: true }),
    ).toBeFalse();
    expect(
      isWizardStepValid(10, { ...base, name: 'Aldric' }, { needsMagicStep: false }),
    ).toBeTrue();
  });

  it('isWizardStepValid exige maîtrise L17 et sorts attitrés L19 pour le magicien', () => {
    const wizardBase = {
      ...base,
      classId: 'cls-magicien',
      spellcastingKind: 'wizard' as const,
      hasSpellcasting: true,
      speciesId: 'sp-humain',
      spellcastingDetails: { cantrips: [{ refId: 'spl-light' }], spells: [{ refId: 'spl-shield' }] },
    };
    expect(
      isWizardStepValid(10, { ...wizardBase, targetLevel: 17 }, { needsMagicStep: true }),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        10,
        {
          ...wizardBase,
          targetLevel: 17,
          spellMasteryPicks: { '1': 'spl-shield', '2': 'spl-invisibility' },
        },
        { needsMagicStep: true },
      ),
    ).toBeTrue();
    expect(
      isWizardStepValid(
        10,
        {
          ...wizardBase,
          targetLevel: 19,
          spellMasteryPicks: { '1': 'spl-shield', '2': 'spl-invisibility' },
        },
        { needsMagicStep: true },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        10,
        {
          ...wizardBase,
          targetLevel: 19,
          spellMasteryPicks: { '1': 'spl-shield', '2': 'spl-invisibility' },
          signatureSpellIds: ['spl-fireball', 'spl-counterspell'],
        },
        { needsMagicStep: true },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid requires bonus languages to be picked', () => {
    expect(
      isWizardStepValid(
        9,
        {
          ...base,
          languages: ['Commun'],
          bonusLanguageCount: 1,
          speciesLanguages: ['Commun'],
        },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        9,
        {
          ...base,
          languages: ['Commun', 'Elfique'],
          bonusLanguageCount: 1,
          speciesLanguages: ['Commun'],
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid counts background languages as locked', () => {
    expect(
      isWizardStepValid(
        9,
        {
          ...base,
          languages: ['Commun', 'Gobelin'],
          bonusLanguageCount: 2,
          speciesLanguages: ['Commun'],
          backgroundLanguages: ['Gobelin'],
        },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid rejects incomplete ASI choices', () => {
    expect(
      isWizardStepValid(
        6,
        {
          ...base,
          pointsRemaining: 0,
          asiChoices: [{ level: 4, mode: 'plus2', primary: null, secondary: null, featId: null }],
        },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        6,
        {
          ...base,
          pointsRemaining: 0,
          asiChoices: [{ level: 4, mode: 'plus2', primary: 'force', secondary: null, featId: null }],
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
    expect(
      isWizardStepValid(
        6,
        {
          ...base,
          pointsRemaining: 0,
          asiChoices: [{ level: 4, mode: 'feat', primary: null, secondary: null, featId: 'feat-alert' }],
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
    expect(
      isWizardStepValid(
        6,
        {
          ...base,
          pointsRemaining: 0,
          asiChoices: [{ level: 4, mode: 'feat', primary: null, secondary: null, featId: null }],
        },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        6,
        {
          ...base,
          pointsRemaining: 0,
          asiChoices: [
            { level: 8, mode: 'plus1plus1', primary: 'force', secondary: 'dexterite', featId: null },
          ],
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
    expect(
      isWizardStepValid(
        6,
        {
          ...base,
          pointsRemaining: 0,
          asiChoices: [
            { level: 8, mode: 'plus1plus1', primary: 'force', secondary: 'force', featId: null },
          ],
        },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid gates abilities, equipment and languages', () => {
    expect(isWizardStepValid(6, { ...base, pointsRemaining: 3 }, { needsMagicStep: false })).toBeFalse();
    expect(
      isWizardStepValid(6, { ...base, pointsRemaining: 0 }, { needsMagicStep: false }),
    ).toBeTrue();
    expect(isWizardStepValid(8, base, { needsMagicStep: false })).toBeFalse();
    expect(
      isWizardStepValid(
        8,
        { ...base, selectedEquipment: [{ instanceId: '1', refId: 'wp-dagger', name: 'Dague', qty: 1 }] as never },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid covers optional steps and unknown step', () => {
    expect(isWizardStepValid(7, { ...base, classId: 'cls-guerrier' }, { needsMagicStep: false })).toBeTrue();
    expect(isWizardStepValid(11, base, { needsMagicStep: false })).toBeTrue();
    expect(isWizardStepValid(12, base, { needsMagicStep: true })).toBeTrue();
    expect(isWizardStepValid(99, base, { needsMagicStep: false })).toBeFalse();
    expect(racialSpellsComplete({ ...base, racialSpellGrants: [] })).toBeTrue();
  });

  it('isWizardStepValid requires identity on step 11 when magic step active', () => {
    expect(isWizardStepValid(11, { ...base, name: '' }, { needsMagicStep: true })).toBeFalse();
    expect(isWizardStepValid(11, { ...base, name: 'Hero' }, { needsMagicStep: true })).toBeTrue();
  });

  it('isWizardStepValid locks the Druide/Roublard class languages out of the bonus count', () => {
    expect(
      isWizardStepValid(
        9,
        {
          ...base,
          classId: 'cls-druide',
          languages: ['Langue des druides'],
          bonusLanguageCount: 1,
        },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        9,
        {
          ...base,
          classId: 'cls-roublard',
          languages: ['Commun', 'Argot des voleurs', 'Gobelin'],
          bonusLanguageCount: 1,
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid case 10 (magic step) falls back to cantrips when hasSpellcasting is false', () => {
    expect(
      isWizardStepValid(
        10,
        { ...base, hasSpellcasting: false, spellcastingDetails: { cantrips: ['sp-light'] } },
        { needsMagicStep: true },
      ),
    ).toBeTrue();
    expect(
      isWizardStepValid(
        10,
        { ...base, hasSpellcasting: false, spellcastingDetails: { cantrips: [] } },
        { needsMagicStep: true },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        10,
        { ...base, hasSpellcasting: false, spellcastingDetails: undefined as never },
        { needsMagicStep: true },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid rejects an empty languages list even with no bonus needed', () => {
    expect(isWizardStepValid(9, { ...base, languages: [] }, { needsMagicStep: false })).toBeFalse();
  });

  it('isWizardStepValid requires a classId even if hitDie is already set', () => {
    expect(
      isWizardStepValid(5, { ...base, classId: null, hitDie: 10 }, { needsMagicStep: false }),
    ).toBeFalse();
  });

  it('racialSpellsComplete defaults missing grants/answers collections to empty', () => {
    expect(racialSpellsComplete({ racialSpellGrants: undefined as never, speciesChoiceAnswers: undefined as never })).toBeTrue();
  });

  it('asiChoicesComplete defaults a missing asiChoices array to empty (always valid)', () => {
    expect(
      isWizardStepValid(6, { ...base, pointsRemaining: 0, asiChoices: undefined as never }, { needsMagicStep: false }),
    ).toBeTrue();
  });

  it('languagesStepComplete defaults missing species/civilization/background language lists to empty', () => {
    expect(
      isWizardStepValid(
        9,
        {
          ...base,
          languages: ['Commun'],
          bonusLanguageCount: 1,
          speciesLanguages: undefined as never,
          civilizationLanguages: undefined as never,
          backgroundLanguages: undefined as never,
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid blocks the magic step when a racial spell grant is still unresolved', () => {
    expect(
      isWizardStepValid(
        10,
        {
          ...base,
          hasSpellcasting: false,
          spellcastingDetails: { cantrips: ['sp-light'] },
          racialSpellGrants: [
            { choiceId: 'elf-cantrip', label: '', desc: '', pool: ['sp-light'], spellLevel: 0, spellcastingAbility: 'INT' },
          ],
          speciesChoiceAnswers: {},
        },
        { needsMagicStep: true },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid requires subclass at level 3+', () => {
    expect(
      isWizardStepValid(
        5,
        { ...base, classId: 'cls-guerrier', hitDie: 10, targetLevel: 3 },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        5,
        { ...base, classId: 'cls-guerrier', hitDie: 10, targetLevel: 3, subclassId: 'sub-champion' },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid requires warlock pact/invocations on a secondary class', () => {
    expect(
      isWizardStepValid(
        5,
        {
          ...base,
          classId: 'cls-guerrier',
          hitDie: 10,
          targetLevel: 5,
          subclassId: 'sub-champion',
          secondaryClasses: [
            {
              classId: 'cls-sorcier',
              className: 'Sorcier',
              level: 3,
              hitDie: 8,
              hpPerLevelAverage: 5,
              hasSpellcasting: true,
              spellcastingKind: 'warlock',
              spellcastingAbility: 'Charisme',
              armorProficiencies: [],
              weaponProficiencies: [],
              toolProficiencies: [],
              skillChooseCount: 0,
              skillOptions: [],
              classFeatures: [],
            },
          ],
        } as CharacterCreation,
        { needsMagicStep: false },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid rejects empty cantrip lists for class casters', () => {
    expect(
      isWizardStepValid(
        10,
        { ...base, hasSpellcasting: true, spellcastingDetails: { cantrips: [], spells: [] } },
        { needsMagicStep: true },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid requires magicien mastery at 17+ and signature spells at 19+', () => {
    const wizard17 = {
      ...base,
      classId: 'cls-magicien',
      hitDie: 6,
      targetLevel: 17,
      hasSpellcasting: true,
      spellcastingKind: 'wizard' as const,
      spellcastingDetails: {
        cantrips: ['sp-a'],
        spells: ['sp-b'],
        spellMastery: [{ spellId: 'x' }],
      },
    };
    expect(isWizardStepValid(10, wizard17, { needsMagicStep: true })).toBeFalse();
    expect(
      isWizardStepValid(
        10,
        {
          ...wizard17,
          spellcastingDetails: {
            cantrips: ['sp-a'],
            spells: ['sp-b'],
            spellMastery: [{ spellId: '1' }, { spellId: '2' }],
          },
        },
        { needsMagicStep: true },
      ),
    ).toBeTrue();

    const wizard19 = {
      ...wizard17,
      targetLevel: 19,
      spellcastingDetails: {
        cantrips: ['sp-a'],
        spells: ['sp-b'],
        spellMastery: [{ spellId: '1' }, { spellId: '2' }],
        signatureSpells: [{ spellId: 's1' }],
      },
    };
    expect(isWizardStepValid(10, wizard19, { needsMagicStep: true })).toBeFalse();
    expect(
      isWizardStepValid(
        10,
        {
          ...wizard19,
          spellMasteryPicks: { '1': 'a', '2': 'b' },
          signatureSpellIds: ['s1', 's2'],
          spellcastingDetails: { cantrips: ['sp-a'], spells: ['sp-b'] },
        },
        { needsMagicStep: true },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid accepts feat-talent with ability/resistance picks and no spends', () => {
    expect(
      isWizardStepValid(
        6,
        {
          ...base,
          pointsRemaining: 0,
          asiChoices: [
            {
              level: 4,
              mode: 'feat',
              primary: null,
              secondary: null,
              featId: 'feat-talent',
              featAbilityChoice: 'force',
              featTalentSpends: [],
            },
          ],
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid requires custom background text fields', () => {
    expect(
      isWizardStepValid(
        4,
        {
          ...base,
          backgroundId: 'bg-custom',
          backgroundPreset: false,
          background: 'Mon histoire',
          privilegeName: '',
          privilegeDesc: 'Desc',
        },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        4,
        {
          ...base,
          backgroundId: 'bg-custom',
          backgroundPreset: false,
          background: 'Mon histoire',
          privilegeName: 'Titre',
          privilegeDesc: 'Description complète.',
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid rejects empty species choice arrays', () => {
    expect(
      isWizardStepValid(
        2,
        { ...base, speciesId: 'sp-humain', speciesChoiceAnswers: { 'choice-x': [] } },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid requires cleric deity on the magic step', () => {
    expect(
      isWizardStepValid(
        10,
        {
          ...base,
          hasSpellcasting: true,
          spellcastingKind: 'cleric',
          spellcastingDetails: { cantrips: ['sp-light'], spells: ['sp-shield'] },
        },
        { needsMagicStep: true },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        10,
        {
          ...base,
          hasSpellcasting: true,
          spellcastingKind: 'cleric',
          spellcastingDetails: { cantrips: ['sp-light'], spells: ['sp-shield'], deityId: 'deity-life' },
        },
        { needsMagicStep: true },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid requires warlock pact and invocations on the primary class', () => {
    expect(
      isWizardStepValid(
        5,
        { ...base, classId: 'cls-sorcier', hitDie: 8, targetLevel: 3 },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        5,
        {
          ...base,
          classId: 'cls-sorcier',
          hitDie: 8,
          targetLevel: 3,
          subclassId: 'sub-fiend',
          pactBoon: 'chain',
          eldritchInvocations: ['inv-armor-of-shadows'],
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid requires ensorceleur metamagic on a secondary class', () => {
    expect(
      isWizardStepValid(
        5,
        {
          ...base,
          classId: 'cls-guerrier',
          hitDie: 10,
          targetLevel: 5,
          subclassId: 'sub-champion',
          secondaryClasses: [
            {
              classId: 'cls-ensorceleur',
              className: 'Ensorceleur',
              level: 3,
              hitDie: 6,
              hpPerLevelAverage: 4,
              hasSpellcasting: true,
              spellcastingKind: 'sorcerer',
              spellcastingAbility: 'Charisme',
              armorProficiencies: [],
              weaponProficiencies: [],
              toolProficiencies: [],
              skillChooseCount: 0,
              skillOptions: [],
              classFeatures: [],
            },
          ],
        } as CharacterCreation,
        { needsMagicStep: false },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid treats exotic/base requirements as constraints within bonus slots', () => {
    // Régression : ne pas exiger bonusCount + exoticCount (ex. 4+1=5) — l'UI compte 4 slots.
    expect(
      isWizardStepValid(
        9,
        {
          ...base,
          languages: ['Commun', 'Cyfand', 'Nain', 'Karphûd', 'Inkulomo', 'Démoniaque'],
          speciesLanguages: ['Commun'],
          civilizationLanguages: ['Cyfand'],
          bonusLanguageCount: 4,
          requiredExoticLanguageCount: 1,
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
    expect(
      isWizardStepValid(
        9,
        {
          ...base,
          languages: ['Commun', 'Cyfand', 'Démoniaque'],
          speciesLanguages: ['Commun'],
          civilizationLanguages: ['Cyfand'],
          bonusLanguageCount: 4,
          requiredExoticLanguageCount: 1,
        },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        9,
        {
          ...base,
          languages: ['Commun', 'Elfique', 'Nain'],
          speciesLanguages: ['Commun'],
          bonusLanguageCount: 2,
          requiredBaseLanguageCount: 2,
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid requires secondary class skill picks', () => {
    expect(
      isWizardStepValid(
        7,
        {
          ...base,
          classId: 'cls-guerrier',
          skillChooseCount: 0,
          selectedSkills: [],
          secondaryClasses: [
            {
              classId: 'cls-roublard',
              className: 'Roublard',
              level: 1,
              hitDie: 8,
              hpPerLevelAverage: 5,
              hasSpellcasting: false,
              spellcastingKind: null,
              spellcastingAbility: null,
              armorProficiencies: [],
              weaponProficiencies: [],
              toolProficiencies: [],
              skillChooseCount: 2,
              skillOptions: ['skill-perception', 'skill-supercherie'],
              classFeatures: [],
            },
          ],
          secondaryClassSelectedSkills: ['skill-perception'],
        } as CharacterCreation,
        { needsMagicStep: false },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid validates equipment alternative picks when slots require a choice', () => {
    const withSlots = {
      ...base,
      selectedEquipment: [{ instanceId: '1', refId: 'wp-dagger', name: 'Dague', qty: 1 }] as never,
      startingEquipmentSlots: [{ slot: 1, alternatives: [[{ id: 'wp-dagger', qty: 1 }], [{ id: 'wp-club', qty: 1 }]] }],
    };
    expect(isWizardStepValid(8, withSlots, { needsMagicStep: false })).toBeTrue();
    expect(
      isWizardStepValid(
        8,
        {
          ...withSlots,
          equipmentWizardPicks: { alt: { '1': 0 } },
        } as CharacterCreation,
        { needsMagicStep: false },
      ),
    ).toBeTrue();
    expect(
      isWizardStepValid(
        8,
        {
          ...withSlots,
          equipmentWizardPicks: { alt: {} },
        } as CharacterCreation,
        { needsMagicStep: false },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid accepts magic via secondary caster cantrips only', () => {
    expect(
      isWizardStepValid(
        10,
        {
          ...base,
          hasSpellcasting: false,
          secondaryClasses: [
            {
              classId: 'cls-druide',
              className: 'Druide',
              level: 1,
              hitDie: 8,
              hpPerLevelAverage: 5,
              hasSpellcasting: true,
              spellcastingKind: 'druid',
              spellcastingAbility: 'Sagesse',
              armorProficiencies: [],
              weaponProficiencies: [],
              toolProficiencies: [],
              skillChooseCount: 0,
              skillOptions: [],
              classFeatures: [],
            },
          ],
          spellcastingDetails: { cantrips: ['sp-druidcraft'], spells: ['sp-healing-word'] },
        } as CharacterCreation,
        { needsMagicStep: true },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid checks secondary magicien high-level picks', () => {
    expect(
      isWizardStepValid(
        10,
        {
          ...base,
          classId: 'cls-guerrier',
          hitDie: 10,
          targetLevel: 5,
          subclassId: 'sub-champion',
          hasSpellcasting: false,
          secondaryClasses: [
            {
              classId: 'cls-magicien',
              className: 'Magicien',
              level: 17,
              hitDie: 6,
              hpPerLevelAverage: 4,
              hasSpellcasting: true,
              spellcastingKind: 'wizard',
              spellcastingAbility: 'Intelligence',
              armorProficiencies: [],
              weaponProficiencies: [],
              toolProficiencies: [],
              skillChooseCount: 0,
              skillOptions: [],
              classFeatures: [],
            },
          ],
          spellcastingDetails: { cantrips: ['sp-a'], spells: ['sp-b'] },
        } as CharacterCreation,
        { needsMagicStep: true },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid counts species bonus skills toward the skills step', () => {
    expect(
      isWizardStepValid(
        7,
        {
          ...base,
          classId: 'cls-guerrier',
          skillChooseCount: 1,
          speciesBonusSkillCount: 1,
          selectedSkills: ['skill-athletisme'],
        },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        7,
        {
          ...base,
          classId: 'cls-guerrier',
          skillChooseCount: 1,
          speciesBonusSkillCount: 1,
          selectedSkills: ['skill-athletisme', 'skill-perception'],
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid accepts equipment when choosable slots exist but wizard picks are omitted', () => {
    expect(
      isWizardStepValid(
        8,
        {
          ...base,
          selectedEquipment: [{ instanceId: '1', refId: 'wp-dagger', name: 'Dague', qty: 1 }] as never,
          backgroundEquipmentSlots: [
            { slot: 2, alternatives: [[{ id: 'gr-livre', qty: 1 }], [{ id: 'gr-loupe', qty: 1 }]] },
          ],
        } as CharacterCreation,
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid accepts a complete secondary ensorceleur metamagic pick', () => {
    expect(
      isWizardStepValid(
        5,
        {
          ...base,
          classId: 'cls-guerrier',
          hitDie: 10,
          targetLevel: 5,
          subclassId: 'sub-champion',
          secondaryClasses: [
            {
              classId: 'cls-ensorceleur',
              className: 'Ensorceleur',
              level: 3,
              hitDie: 6,
              hpPerLevelAverage: 4,
              hasSpellcasting: true,
              spellcastingKind: 'sorcerer',
              spellcastingAbility: 'Charisme',
              armorProficiencies: [],
              weaponProficiencies: [],
              toolProficiencies: [],
              skillChooseCount: 0,
              skillOptions: [],
              classFeatures: [],
              subclassId: 'sub-wild',
              metamagicOptions: ['mm-quickened'],
            },
          ],
        } as CharacterCreation,
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid rejects skills step without a classId', () => {
    expect(isWizardStepValid(7, { ...base, classId: null }, { needsMagicStep: false })).toBeFalse();
  });

  it('isWizardStepValid rejects secondary warlock missing invocations at level 2', () => {
    expect(
      isWizardStepValid(
        5,
        {
          ...base,
          classId: 'cls-guerrier',
          hitDie: 10,
          targetLevel: 5,
          subclassId: 'sub-champion',
          secondaryClasses: [
            {
              classId: 'cls-sorcier',
              className: 'Sorcier',
              level: 2,
              hitDie: 8,
              hpPerLevelAverage: 5,
              hasSpellcasting: true,
              spellcastingKind: 'warlock',
              spellcastingAbility: 'Charisme',
              armorProficiencies: [],
              weaponProficiencies: [],
              toolProficiencies: [],
              skillChooseCount: 0,
              skillOptions: [],
              classFeatures: [],
              subclassId: 'sub-fiend',
              pactBoon: 'chain',
            },
          ],
        } as CharacterCreation,
        { needsMagicStep: false },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid rejects primary warlock missing invocations at level 2', () => {
    expect(
      isWizardStepValid(
        5,
        {
          ...base,
          classId: 'cls-sorcier',
          hitDie: 8,
          targetLevel: 2,
          subclassId: 'sub-fiend',
          pactBoon: 'chain',
        },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid rejects secondary class missing subclass at level 3', () => {
    expect(
      isWizardStepValid(
        5,
        {
          ...base,
          classId: 'cls-guerrier',
          hitDie: 10,
          targetLevel: 5,
          subclassId: 'sub-champion',
          secondaryClasses: [
            {
              classId: 'cls-roublard',
              className: 'Roublard',
              level: 3,
              hitDie: 8,
              hpPerLevelAverage: 5,
              hasSpellcasting: false,
              spellcastingKind: null,
              spellcastingAbility: null,
              armorProficiencies: [],
              weaponProficiencies: [],
              toolProficiencies: [],
              skillChooseCount: 0,
              skillOptions: [],
              classFeatures: [],
            },
          ],
        } as CharacterCreation,
        { needsMagicStep: false },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid accepts equipment with tool slots and no choosable alternatives', () => {
    expect(
      isWizardStepValid(
        8,
        {
          ...base,
          selectedEquipment: [{ instanceId: '1', refId: 'tl-luth', name: 'Luth', qty: 1 }] as never,
          toolEquipmentSlots: [{ slot: 3, fixed: [{ id: 'tl-luth', qty: 1 }] }],
        } as CharacterCreation,
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid rejects equipment step when nothing is selected', () => {
    expect(
      isWizardStepValid(
        8,
        {
          ...base,
          selectedEquipment: [],
          startingEquipmentSlots: [{ slot: 1, fixed: [{ id: 'wp-dagger', qty: 1 }] }],
        } as CharacterCreation,
        { needsMagicStep: false },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid resolves wizard level from spellcastingKind alone', () => {
    expect(
      isWizardStepValid(
        10,
        {
          ...base,
          classId: 'cls-rodeur',
          spellcastingKind: 'wizard',
          targetLevel: 17,
          hasSpellcasting: true,
          spellcastingDetails: { cantrips: ['sp-a'], spells: ['sp-b'] },
        },
        { needsMagicStep: true },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid accepts feat-talent when talent spends are present', () => {
    expect(
      isWizardStepValid(
        6,
        {
          ...base,
          pointsRemaining: 0,
          asiChoices: [
            {
              level: 4,
              mode: 'feat',
              primary: null,
              secondary: null,
              featId: 'feat-talent',
              featTalentSpends: [{ id: 's1', type: 'skill', skillId: 'skill-arcanes' }],
            },
          ],
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid accepts magic details via deity-only cleric setup', () => {
    expect(
      isWizardStepValid(
        10,
        {
          ...base,
          hasSpellcasting: true,
          spellcastingKind: 'cleric',
          spellcastingDetails: { cantrips: [], spells: [], deity: 'Pelor' },
        },
        { needsMagicStep: true },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid accepts languages step when no bonus languages are required', () => {
    expect(
      isWizardStepValid(
        9,
        { ...base, languages: ['Commun'], bonusLanguageCount: 0 },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid accepts caster magic details with spells but no cantrips', () => {
    expect(
      isWizardStepValid(
        10,
        {
          ...base,
          hasSpellcasting: true,
          spellcastingDetails: { cantrips: [], spells: [{ refId: 'spl-shield' }] },
        },
        { needsMagicStep: true },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid rejects equipment when a choosable slot has no wizard pick', () => {
    expect(
      isWizardStepValid(
        8,
        {
          ...base,
          selectedEquipment: [{ instanceId: '1', refId: 'wp-dagger', name: 'Dague', qty: 1 }] as never,
          startingEquipmentSlots: [
            { slot: 1, alternatives: [[{ id: 'wp-dagger', qty: 1 }], [{ id: 'wp-club', qty: 1 }]] },
            { slot: 2, alternatives: [[{ id: 'gr-livre', qty: 1 }], [{ id: 'gr-loupe', qty: 1 }]] },
          ],
          equipmentWizardPicks: { alt: { '1': 0 } },
        } as CharacterCreation,
        { needsMagicStep: false },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid accepts signature spells via spellcastingDetails array at level 19', () => {
    expect(
      isWizardStepValid(
        10,
        {
          ...base,
          classId: 'cls-magicien',
          spellcastingKind: 'wizard',
          targetLevel: 19,
          hasSpellcasting: true,
          spellcastingDetails: {
            cantrips: ['sp-a'],
            spells: ['sp-b'],
            spellMastery: [{ spellId: '1' }, { spellId: '2' }],
            signatureSpells: [{ spellId: 's1' }, { spellId: 's2' }],
          },
        },
        { needsMagicStep: true },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid rejects custom background when privilege name is whitespace only', () => {
    expect(
      isWizardStepValid(
        4,
        {
          ...base,
          backgroundId: 'bg-custom',
          backgroundPreset: false,
          background: 'Story',
          privilegeName: '   ',
          privilegeDesc: 'Desc',
        },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid gates civilization and background ids', () => {
    expect(isWizardStepValid(3, { ...base, civilizationId: null }, { needsMagicStep: false })).toBeFalse();
    expect(isWizardStepValid(4, { ...base, backgroundId: null }, { needsMagicStep: false })).toBeFalse();
  });

  it('isWizardStepValid accepts complete secondary class skill selections', () => {
    expect(
      isWizardStepValid(
        7,
        {
          ...base,
          classId: 'cls-guerrier',
          skillChooseCount: 0,
          selectedSkills: [],
          secondaryClasses: [
            {
              classId: 'cls-roublard',
              className: 'Roublard',
              level: 1,
              hitDie: 8,
              hpPerLevelAverage: 5,
              hasSpellcasting: false,
              spellcastingKind: null,
              spellcastingAbility: null,
              armorProficiencies: [],
              weaponProficiencies: [],
              toolProficiencies: [],
              skillChooseCount: 2,
              skillOptions: ['skill-perception', 'skill-supercherie'],
              classFeatures: [],
            },
          ],
          secondaryClassSelectedSkills: ['skill-perception', 'skill-supercherie'],
        } as CharacterCreation,
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid rejects magic step when spellcasting details are missing', () => {
    expect(
      isWizardStepValid(
        10,
        { ...base, hasSpellcasting: true, spellcastingDetails: undefined as never },
        { needsMagicStep: true },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid accepts a secondary spellcaster on the magic step without primary spellcasting', () => {
    expect(
      isWizardStepValid(
        10,
        {
          ...base,
          hasSpellcasting: false,
          secondaryClasses: [
            {
              classId: 'cls-druide',
              className: 'Druide',
              level: 1,
              hitDie: 8,
              hpPerLevelAverage: 5,
              hasSpellcasting: true,
              spellcastingKind: 'druid',
              spellcastingAbility: 'Sagesse',
              armorProficiencies: [],
              weaponProficiencies: [],
              toolProficiencies: [],
              skillChooseCount: 0,
              skillOptions: [],
              classFeatures: [],
            },
          ],
          spellcastingDetails: { spells: [{ refId: 'spl-heal' }] },
        } as CharacterCreation,
        { needsMagicStep: true },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid rejects class step when hit die is zero', () => {
    expect(
      isWizardStepValid(
        5,
        { ...base, classId: 'cls-guerrier', hitDie: 0 },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid accepts feat-talent with resistance choice and no spends', () => {
    expect(
      isWizardStepValid(
        6,
        {
          ...base,
          pointsRemaining: 0,
          asiChoices: [
            {
              level: 4,
              mode: 'feat',
              primary: null,
              secondary: null,
              featId: 'feat-talent',
              featResistanceChoice: 'feu',
              featTalentSpends: [],
            },
          ],
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid accepts wizard high-level picks via spellcastingDetails arrays', () => {
    expect(
      isWizardStepValid(
        10,
        {
          ...base,
          classId: 'cls-magicien',
          spellcastingKind: 'wizard',
          targetLevel: 19,
          hasSpellcasting: true,
          spellcastingDetails: {
            cantrips: ['sp-a'],
            spells: ['sp-b'],
            spellMastery: [{ spellId: '1' }, { spellId: '2' }],
            signatureSpells: [{ spellId: 's1' }, { spellId: 's2' }],
          },
        },
        { needsMagicStep: true },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid rejects empty cantrip and spell lists without a deity', () => {
    expect(
      isWizardStepValid(
        10,
        {
          ...base,
          hasSpellcasting: true,
          spellcastingDetails: { cantrips: [], spells: [] },
        },
        { needsMagicStep: true },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid accepts equipment with background and tool slot sources', () => {
    expect(
      isWizardStepValid(
        8,
        {
          ...base,
          selectedEquipment: [{ instanceId: '1', refId: 'wp-dagger', name: 'Dague', qty: 1 }] as never,
          startingEquipmentSlots: [{ slot: 1, fixed: [{ id: 'wp-dagger', qty: 1 }] }],
          backgroundEquipmentSlots: [{ slot: 2, fixed: [{ id: 'gr-livre', qty: 1 }] }],
          toolEquipmentSlots: [{ slot: 3, fixed: [{ id: 'tl-luth', qty: 1 }] }],
        } as CharacterCreation,
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('isWizardStepValid accepts a valid secondary warlock at level 3 with pact and invocations', () => {
    expect(
      isWizardStepValid(
        5,
        {
          ...base,
          classId: 'cls-guerrier',
          hitDie: 10,
          targetLevel: 5,
          subclassId: 'sub-champion',
          secondaryClasses: [
            {
              classId: 'cls-sorcier',
              className: 'Sorcier',
              level: 3,
              hitDie: 8,
              hpPerLevelAverage: 5,
              hasSpellcasting: true,
              spellcastingKind: 'warlock',
              spellcastingAbility: 'Charisme',
              armorProficiencies: [],
              weaponProficiencies: [],
              toolProficiencies: [],
              skillChooseCount: 0,
              skillOptions: [],
              classFeatures: [],
              subclassId: 'sub-fiend',
              pactBoon: 'chain',
              eldritchInvocations: ['inv-armor-of-shadows'],
            },
          ],
        } as CharacterCreation,
        { needsMagicStep: false },
      ),
    ).toBeTrue();
  });

  it('racialSpellsComplete rejects unresolved wizard cantrip placeholders', () => {
    expect(
      racialSpellsComplete({
        racialSpellGrants: [
          { choiceId: 'g1', label: '', desc: '', pool: [], spellLevel: 0, spellcastingAbility: 'INT' },
        ],
        speciesChoiceAnswers: { g1: ['any_wizard_cantrip'] },
      }),
    ).toBeFalse();
  });

  it('isWizardStepValid rejects custom background missing description text', () => {
    expect(
      isWizardStepValid(
        4,
        {
          ...base,
          backgroundId: 'bg-custom',
          backgroundPreset: false,
          background: '   ',
          privilegeName: 'Titre',
          privilegeDesc: 'Desc',
        },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid rejects equipment step when no slots and nothing selected', () => {
    expect(
      isWizardStepValid(
        8,
        {
          ...base,
          selectedEquipment: [],
          startingEquipmentSlots: [],
          backgroundEquipmentSlots: [],
          toolEquipmentSlots: [],
        } as CharacterCreation,
        { needsMagicStep: false },
      ),
    ).toBeFalse();
  });

  it('isWizardStepValid rejects secondary warlock at level 2 without invocations', () => {
    expect(
      isWizardStepValid(
        5,
        {
          ...base,
          classId: 'cls-guerrier',
          hitDie: 10,
          targetLevel: 5,
          subclassId: 'sub-champion',
          secondaryClasses: [
            {
              classId: 'cls-sorcier',
              className: 'Sorcier',
              level: 2,
              hitDie: 8,
              hpPerLevelAverage: 5,
              hasSpellcasting: true,
              spellcastingKind: 'warlock',
              spellcastingAbility: 'Charisme',
              armorProficiencies: [],
              weaponProficiencies: [],
              toolProficiencies: [],
              skillChooseCount: 0,
              skillOptions: [],
              classFeatures: [],
              subclassId: 'sub-fiend',
              pactBoon: null,
              eldritchInvocations: [],
            },
          ],
        } as CharacterCreation,
        { needsMagicStep: false },
      ),
    ).toBeFalse();
  });

  it('racialSpellsComplete treats missing speciesChoiceAnswers as empty picks', () => {
    expect(
      racialSpellsComplete({
        racialSpellGrants: [
          { choiceId: 'g1', label: '', desc: '', pool: ['spl-a'], spellLevel: 0, spellcastingAbility: 'INT' },
        ],
        speciesChoiceAnswers: {},
      }),
    ).toBeFalse();
  });
});
