import { isWizardStepValid, racialSpellsComplete } from '../character-wizard-validation.util';
import type { CharacterCreation } from '@core/models/Character/character';
import { base } from './spec-helpers';

describe('character-wizard-validation steps', () => {
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
  it('isWizardStepValid rejects an empty languages list even with no bonus needed', () => {
    expect(isWizardStepValid(9, { ...base, languages: [] }, { needsMagicStep: false })).toBeFalse();
  });
  it('isWizardStepValid requires a classId even if hitDie is already set', () => {
    expect(
      isWizardStepValid(5, { ...base, classId: null, hitDie: 10 }, { needsMagicStep: false }),
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
  it('isWizardStepValid rejects feat-talent with ability pick but no flexible spends', () => {
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
    ).toBeFalse();
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
    expect(isWizardStepValid(8, withSlots, { needsMagicStep: false })).toBeFalse();
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
  it('isWizardStepValid rejects equipment when choosable slots exist but wizard picks are omitted', () => {
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
    ).toBeFalse();
  });
  it('isWizardStepValid rejects skills step without a classId', () => {
    expect(isWizardStepValid(7, { ...base, classId: null }, { needsMagicStep: false })).toBeFalse();
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
  it('isWizardStepValid accepts feat-talent when talent spends total 4 pts', () => {
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
              featTalentSpends: [
                { id: 's1', type: 'skill', skillId: 'skill-arcanes' },
                { id: 's2', type: 'skill', skillId: 'skill-histoire' },
                { id: 's3', type: 'tool', toolId: 'tl-alchimiste' },
                { id: 's4', type: 'weapon', weaponId: 'wp-dague' },
              ],
            },
          ],
        },
        { needsMagicStep: false },
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
  it('isWizardStepValid rejects class step when hit die is zero', () => {
    expect(
      isWizardStepValid(
        5,
        { ...base, classId: 'cls-guerrier', hitDie: 0 },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
  });
  it('isWizardStepValid rejects feat-talent with resistance choice and no spends', () => {
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
  it('covers remaining class, language and identity branches', () => {
    expect(isWizardStepValid(12, base, { needsMagicStep: false })).toBeTrue();
    expect(isWizardStepValid(99, base, { needsMagicStep: false })).toBeFalse();
    expect(isWizardStepValid(9, { ...base, languages: [] }, { needsMagicStep: false })).toBeFalse();
    expect(
      isWizardStepValid(
        5,
        { ...base, classId: 'cls-sorcier', hitDie: 8, targetLevel: 2, eldritchInvocations: [] },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        5,
        { ...base, classId: 'cls-ensorceleur', hitDie: 6, targetLevel: 3, subclassId: 'sub', metamagicOptions: [] },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        5,
        {
          ...base,
          classId: 'cls-guerrier',
          hitDie: 10,
          secondaryClasses: [{ classId: 'cls-barde', className: 'Barde', level: 3 }],
        } as CharacterCreation,
        { needsMagicStep: false },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        2,
        { ...base, speciesId: 'sp-elfe', speciesChoiceAnswers: { racial: [] } },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        6,
        {
          ...base,
          pointsRemaining: 0,
          asiChoices: [{ level: 4, mode: 'plus1plus1', primary: 'force', secondary: 'force', featId: null }],
        },
        { needsMagicStep: false },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        11,
        { ...base, name: 'Héros' },
        { needsMagicStep: true },
      ),
    ).toBeTrue();
    expect(isWizardStepValid(11, { ...base, name: '  ' }, { needsMagicStep: true })).toBeFalse();
    expect(isWizardStepValid(11, base, { needsMagicStep: false })).toBeTrue();
  });

  it('isWizardStepValid exige pacte / métamagie / outils d’historique et refuse les choix non résolus', () => {
    expect(
      isWizardStepValid(
        5,
        { ...base, classId: 'cls-sorcier', hitDie: 8, targetLevel: 3, subclassId: 'hex', pactBoon: null },
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
          subclassId: 'hex',
          pactBoon: 'pact-chaine',
          eldritchInvocations: ['inv-1'],
        },
        { needsMagicStep: false },
      ),
    ).toBeTrue();
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
              subclassId: 'hex',
              pactBoon: null,
              eldritchInvocations: ['inv-1'],
            },
          ],
        } as CharacterCreation,
        { needsMagicStep: false },
      ),
    ).toBeFalse();
    expect(
      isWizardStepValid(
        7,
        {
          ...base,
          classId: 'cls-guerrier',
          skillChooseCount: 0,
          selectedSkills: [],
          weaponProficiencies: ['wp-any'],
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
          skillChooseCount: 0,
          selectedSkills: [],
          toolProficiencies: ['any'],
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
          skillChooseCount: 0,
          selectedSkills: [],
          backgroundProficiencies: { tools: { choose: [{ chooseCount: 1, options: ['tl-a'] }] } },
          backgroundTools: [],
        } as CharacterCreation,
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
            {
              level: 4,
              mode: 'feat',
              primary: null,
              secondary: null,
              featId: 'feat-alerte',
              featTalentSpends: [{ id: 's1', type: 'skill' }],
            },
          ],
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
});
