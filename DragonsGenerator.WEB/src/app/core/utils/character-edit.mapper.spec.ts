import { CURRENT_SCHEMA_VERSION, type Character } from '@core/models/Character/character';
import {
  mapCharacterToEditState,
  validateCharacterForEdit,
} from './character-edit.mapper';

function sampleCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    cloudSynced: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    name: 'Aria',
    species: { id: 'spc-elfe', label: 'Elfe' },
    size: 'M',
    civilization: { id: 'civ-nordique', label: 'Nordique' },
    backgroundRef: { id: 'bg-acolyte', label: 'Acolyte' },
    classes: [{ classId: 'cls-mage', classLabel: 'Mage', level: 3, hitDie: 6 }],
    totalLevel: 3,
    experience: 0,
    abilities: {
      force: 8,
      dexterite: 14,
      constitution: 12,
      intelligence: 16,
      sagesse: 10,
      charisme: 10,
    },
    abilityModifiers: {
      force: -1,
      dexterite: 2,
      constitution: 1,
      intelligence: 3,
      sagesse: 0,
      charisme: 0,
    },
    proficiencyBonus: 2,
    vitality: {
      hitPointsMax: 18,
      hitPointsCurrent: 18,
      hitPointsTemporary: 0,
      woundThreshold: 9,
      hitDice: [{ dieType: 6, total: 3, used: 0 }],
      fatigue: 0,
      deathSaves: { successes: 0, failures: 0 },
      inspiration: false,
    },
    defense: {
      armorClass: 13,
      armorType: 'Aucune',
      hasShield: false,
      resistances: [],
      immunities: [],
      vulnerabilities: [],
      conditionImmunities: [],
      harmfulStates: [],
    },
    initiative: 2,
    attacks: [],
    movement: { walk: 9, climb: 4, swim: 4, jumpHeight: 3, jumpLength: 3 },
    senses: { passivePerception: 12, hasDarkvision: true, darkvisionRadius: 18 },
    proficiencies: {
      armor: [],
      weapons: ['wp-dague'],
      tools: [],
      savingThrows: ['Intelligence', 'Sagesse'],
      skills: ['skill-arcana', 'skill-investigation'],
      expertiseSkills: [],
      languages: ['Commun', 'Elfique'],
      writingSystems: ['Runique'],
    },
    features: [
      { refId: 'feat-trait-elfe', name: 'Vision', source: 'species', sourceDetail: '', level: 1 },
      { refId: 'feat-tradition', name: 'Tradition', source: 'class', sourceDetail: '', level: 2 },
    ],
    equipment: [],
    currency: { cuivre: 0, argent: 0, or: 10, platine: 0 },
    carryCapacity: {
      currentKg: 0,
      maxKg: 60,
      encumberedAtKg: 40,
      heavilyEncumberedAtKg: 50,
      status: 'normal',
    },
    spellcasting: {
      kind: 'wizard',
      ability: 'Intelligence',
      spellSaveDC: 13,
      spellAttackBonus: 5,
      focus: null,
      spellSlots: [{ level: 1, max: 4, used: 0 }],
      cantrips: { max: 3, used: 0 },
      arcaneTradition: 'Évocation',
      spellMastery: [{ spellLevel: 1, spellId: 'spl-magic-missile', spellName: 'Projectile magique' }],
      signatureSpells: [{ spellId: 'spl-shield', spellName: 'Bouclier' }],
    },
    knownSpells: [
      { refId: 'spl-light', name: 'Lumière', level: 0, prepared: true },
      { refId: 'spl-shield', name: 'Bouclier', level: 1, prepared: true },
    ],
    personality: {
      description: 'Mage elfe',
      sex: 'F',
      background: 'Études arcaniques',
      alignment: 'Neutre bon',
      traits: 'Curieuse',
      ideal: 'Savoir',
      bonds: 'Guilde',
      flaws: 'Orgueil',
      handicap: '',
      story: 'Origines nordiques',
      awakened: false,
      madness: '',
      corruption: { stage1: 0, stage2: 0, stage3: 0, stage4: 0 },
    },
    ...overrides,
  } as Character;
}

describe('character-edit.mapper', () => {
  it('validateCharacterForEdit accepts a complete character', () => {
    expect(validateCharacterForEdit(sampleCharacter())).toEqual([]);
  });

  it('validateCharacterForEdit reports missing essentials', () => {
    const broken = sampleCharacter({
      id: '',
      species: { id: '', label: '' },
      civilization: { id: '', label: '' },
      classes: [],
    });
    const errors = validateCharacterForEdit(broken);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes('identifiant'))).toBeTrue();
    expect(errors.some((e) => e.includes('espèce'))).toBeTrue();
  });

  it('mapCharacterToEditState restores wizard creation state', () => {
    const { creation, editing } = mapCharacterToEditState(sampleCharacter());

    expect(editing.id).toBe('char-1');
    expect(editing.cloudSynced).toBeTrue();
    expect(creation.name).toBe('Aria');
    expect(creation.classId).toBe('cls-mage');
    expect(creation.targetLevel).toBe(3);
    expect(creation.spellcastingKind).toBe('wizard');
    expect(creation.signatureSpellIds).toEqual(['spl-shield']);
    expect(creation.spellMasteryPicks['1']).toBe('spl-magic-missile');
    const details = creation.spellcastingDetails as {
      cantrips?: unknown[];
      spells?: unknown[];
    };
    expect(details.cantrips?.length).toBe(1);
    expect(details.spells?.length).toBe(1);
    expect(creation.pointsRemaining).toBe(0);
  });

  it('mapCharacterToEditState maps warlock pact fields', () => {
    const saved = sampleCharacter({
      spellcasting: {
        kind: 'warlock',
        ability: 'Charisme',
        spellSaveDC: 12,
        spellAttackBonus: 4,
        focus: null,
        spellSlots: [{ level: 2, max: 2, used: 0 }],
        cantrips: { max: 2, used: 0 },
        patron: 'Fiélon',
        pact: 'Lame du pacte',
        eldritchInvocations: ['invoc-arme-du-pacte'],
        mysticArcanum: [{ spellLevel: 6, spellId: 'spl-circle-death', spellName: 'Cercle de mort' }],
      },
      knownSpells: [],
    });

    const { creation } = mapCharacterToEditState(saved);
    expect(creation.spellcastingKind).toBe('warlock');
    expect(creation.pactBoon).toBe('Lame du pacte');
    expect(creation.eldritchInvocations).toEqual(['invoc-arme-du-pacte']);
    expect(creation.mysticArcanumPicks['6']).toBe('spl-circle-death');
  });

  it('mapCharacterToEditState restores asiChoices without ctx (bonuses/featIds only)', () => {
    const saved = sampleCharacter({
      asiChoices: [{ level: 4, mode: 'plus2', primary: 'intelligence' }],
    });
    const { creation } = mapCharacterToEditState(saved);
    expect(creation.asiBonuses.intelligence).toBe(2);
    expect(creation.talentBonusSkills).toEqual([]);
  });

  it('mapCharacterToEditState re-aggregates "Talent" spends when feats/spells ctx is provided', () => {
    const saved = sampleCharacter({
      asiChoices: [
        {
          level: 4,
          mode: 'feat',
          featId: 'don-talent',
          featTalentSpends: [
            { id: '1', type: 'skill', skillId: 'skill-arcanes' },
            { id: '2', type: 'cantrips', cantripIds: ['spl-lueur'] },
          ],
        },
      ],
    });
    const feats = new Map([['don-talent', { benefits: [{ type: 'flexible_points', total: 4 }] }]]);
    const spells = new Map([
      ['spl-lueur', { id: 'spl-lueur', name: 'Lueur', level: 0, description: '' } as any],
    ]);

    const { creation } = mapCharacterToEditState(saved, { feats, spells });
    expect(creation.talentBonusSkills).toEqual(['skill-arcanes']);
    expect(creation.talentBonusCantrips?.length).toBe(1);
    expect(creation.talentBonusCantrips?.[0].name).toBe('Lueur');
    expect(creation.selectedFeatIds).toEqual(['don-talent']);
  });

  it('mapCharacterToEditState reconstructs secondaryClasses[] from a multiclass character and keeps targetLevel on the primary class only', () => {
    const saved = sampleCharacter({
      classes: [
        { classId: 'cls-mage', classLabel: 'Mage', level: 3, hitDie: 6 },
        {
          classId: 'cls-guerrier',
          classLabel: 'Guerrier',
          subclassId: 'sub-champion',
          subclassLabel: 'Champion',
          level: 2,
          hitDie: 10,
        },
      ],
      totalLevel: 5,
    });

    const { creation } = mapCharacterToEditState(saved);

    // targetLevel ne reflète QUE le niveau de la classe primaire, pas le total multiclasse.
    expect(creation.classId).toBe('cls-mage');
    expect(creation.targetLevel).toBe(3);

    expect(creation.secondaryClasses?.length).toBe(1);
    expect(creation.secondaryClasses?.[0]).toEqual(
      jasmine.objectContaining({
        classId: 'cls-guerrier',
        className: 'Guerrier',
        subclassId: 'sub-champion',
        subclassName: 'Champion',
        level: 2,
        hitDie: 10,
      }),
    );
  });

  it('mapCharacterToEditState leaves secondaryClasses empty for a single-class character', () => {
    const { creation } = mapCharacterToEditState(sampleCharacter());
    expect(creation.secondaryClasses).toEqual([]);
  });
});
