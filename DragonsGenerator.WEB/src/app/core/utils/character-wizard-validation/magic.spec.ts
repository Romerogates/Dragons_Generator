import { isWizardStepValid } from '../character-wizard-validation.util';
import type { CharacterCreation } from '@core/models/Character/character';
import { base, WIZARD_CANTRIPS, WIZARD_SPELLS, CLERIC_CANTRIPS } from './spec-helpers';

describe('character-wizard-validation magic', () => {
  it('isWizardStepValid handles magic step identity vs spellcasting', () => {
    const withMagic = {
      ...base,
      speciesId: 'sp-elf',
      hasSpellcasting: true,
      spellcastingKind: 'bard' as const,
      spellcastingDetails: {
        cantrips: ['sp-a', 'sp-b'],
        spells: ['sp-1', 'sp-2', 'sp-3', 'sp-4'],
      },
      name: 'Aldric',
    };
    expect(isWizardStepValid(10, withMagic, { needsMagicStep: true })).toBeTrue();
    expect(
      isWizardStepValid(10, { ...withMagic, spellcastingDetails: {} }, { needsMagicStep: true }),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        10,
        {
          ...withMagic,
          spellcastingKind: 'wizard' as const,
          spellcastingDetails: { cantrips: ['sp-light'], spells: [] },
        },
        { needsMagicStep: true },
      ),
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
      spellcastingDetails: {
        cantrips: [
          { refId: 'spl-light' },
          { refId: 'spl-mage-hand' },
          { refId: 'spl-prestidigitation' },
        ],
        spells: [
          { refId: 'spl-shield' },
          { refId: 'spl-magic-missile' },
          { refId: 'spl-detect-magic' },
          { refId: 'spl-mage-armor' },
          { refId: 'spl-sleep' },
          { refId: 'spl-burning-hands' },
        ],
      },
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
  it('isWizardStepValid requires identity on step 11 when magic step active', () => {
    expect(isWizardStepValid(11, { ...base, name: '' }, { needsMagicStep: true })).toBeFalse();
    expect(isWizardStepValid(11, { ...base, name: 'Hero' }, { needsMagicStep: true })).toBeTrue();
  });
  it('isWizardStepValid case 10 (magic step) racial-only needs grants complete', () => {
    expect(
      isWizardStepValid(
        10,
        { ...base, hasSpellcasting: false, spellcastingDetails: { cantrips: [] } },
        { needsMagicStep: true },
      ),
    ).toBeTrue();
    expect(
      isWizardStepValid(
        10,
        {
          ...base,
          hasSpellcasting: false,
          racialSpellGrants: [
            { choiceId: 'elf-cantrip', label: '', desc: '', pool: [], spellLevel: 0, spellcastingAbility: 'INT' },
          ],
          speciesChoiceAnswers: {},
          spellcastingDetails: {},
        },
        { needsMagicStep: true },
      ),
    ).toBeFalse();
  });
  it('isWizardStepValid requires primary ensorceleur metamagic at level 3+', () => {
    expect(
      isWizardStepValid(
        5,
        {
          ...base,
          classId: 'cls-ensorceleur',
          hitDie: 6,
          targetLevel: 3,
          subclassId: 'sub-draconic',
          metamagicOptions: [],
        },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        5,
        {
          ...base,
          classId: 'cls-ensorceleur',
          hitDie: 6,
          targetLevel: 3,
          subclassId: 'sub-draconic',
          metamagicOptions: ['mm-careful'],
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
        cantrips: WIZARD_CANTRIPS,
        spells: WIZARD_SPELLS,
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
            cantrips: WIZARD_CANTRIPS,
            spells: WIZARD_SPELLS,
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
        cantrips: WIZARD_CANTRIPS,
        spells: WIZARD_SPELLS,
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
          spellcastingDetails: { cantrips: WIZARD_CANTRIPS, spells: WIZARD_SPELLS },
        },
        { needsMagicStep: true },
      ),
    ).toBeTrue();
  });
  it('isWizardStepValid requires cleric deity on the magic step', () => {
    expect(
      isWizardStepValid(
        10,
        {
          ...base,
          hasSpellcasting: true,
          spellcastingKind: 'cleric',
          spellcastingDetails: { cantrips: CLERIC_CANTRIPS, spells: ['sp-shield'] },
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
          spellcastingDetails: {
            cantrips: CLERIC_CANTRIPS,
            spells: ['sp-shield'],
            deityId: 'deity-life',
          },
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
  it('isWizardStepValid requires cleric cantrips plus deity', () => {
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
    ).toBeFalse();
    expect(
      isWizardStepValid(
        10,
        {
          ...base,
          hasSpellcasting: true,
          spellcastingKind: 'cleric',
          spellcastingDetails: { cantrips: CLERIC_CANTRIPS, spells: [], deity: 'Pelor' },
        },
        { needsMagicStep: true },
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
            cantrips: WIZARD_CANTRIPS,
            spells: WIZARD_SPELLS,
            spellMastery: [{ spellId: '1' }, { spellId: '2' }],
            signatureSpells: [{ spellId: 's1' }, { spellId: 's2' }],
          },
        },
        { needsMagicStep: true },
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
            cantrips: WIZARD_CANTRIPS,
            spells: WIZARD_SPELLS,
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
});
