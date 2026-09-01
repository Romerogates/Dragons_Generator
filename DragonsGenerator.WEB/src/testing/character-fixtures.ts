import {
  CURRENT_SCHEMA_VERSION,
  type Character,
  type CharacterSpellcasting,
  type SpellInstance,
} from '@core/models/Character/character';

const DEFAULT_ABILITIES = {
  force: 10,
  dexterite: 14,
  constitution: 13,
  intelligence: 15,
  sagesse: 12,
  charisme: 8,
};

const DEFAULT_MODIFIERS = {
  force: 0,
  dexterite: 2,
  constitution: 1,
  intelligence: 2,
  sagesse: 1,
  charisme: -1,
};

const BASE_SPELL_SLOTS = [
  { level: 1, max: 4, used: 1 },
  { level: 2, max: 3, used: 0 },
  { level: 3, max: 2, used: 0 },
];

function makeSpellInstances(count: number, startId = 1): SpellInstance[] {
  return Array.from({ length: count }, (_, i) => ({
    refId: `spl-test-${startId + i}`,
    name: `Sort test ${startId + i}`,
    level: (i % 3) + 1,
    prepared: i % 2 === 0,
    effectSummary: 'Effet de test pour le grimoire PDF.',
  }));
}

/** Personnage minimal valide pour export PDF / validation. */
export function createMinimalCharacter(overrides: Partial<Character> = {}): Character {
  const base: Character = {
    id: 'test-char-1',
    schemaVersion: CURRENT_SCHEMA_VERSION,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: 'Test Hero',
    species: { id: 'spc-humain', label: 'Humain' },
    size: 'M',
    civilization: { id: 'civ-ajagar', label: 'Ajagar' },
    backgroundRef: { id: 'bg-erudit', label: 'Érudit' },
    privilegeRef: null,
    classes: [
      {
        classId: 'cls-lettre',
        classLabel: 'Lettré',
        level: 1,
        hitDie: 8,
        subclassId: undefined,
        subclassLabel: undefined,
      },
    ],
    totalLevel: 1,
    experience: 0,
    abilities: { ...DEFAULT_ABILITIES },
    abilityModifiers: { ...DEFAULT_MODIFIERS },
    proficiencyBonus: 2,
    vitality: {
      hitPointsMax: 11,
      hitPointsCurrent: 11,
      hitPointsTemporary: 0,
      woundThreshold: 6,
      hitDice: [{ dieType: 8, total: 1, used: 0 }],
      fatigue: 0,
      deathSaves: { successes: 0, failures: 0 },
      inspiration: false,
    },
    defense: {
      armorClass: 12,
      armorType: 'Armure de cuir',
      hasShield: false,
      resistances: [],
      immunities: [],
      vulnerabilities: [],
      conditionImmunities: [],
      harmfulStates: [],
    },
    initiative: 2,
    attacks: [
      {
        name: 'Dague',
        source: 'weapon',
        refId: 'wp-dague',
        attackBonus: 4,
        damage: '1d4+2',
        damageType: 'perforant',
        range: 'Corps à corps',
      },
    ],
    movement: { walk: 9, climb: 4, swim: 4, jumpHeight: 2, jumpLength: 3 },
    senses: { passivePerception: 11, hasDarkvision: false, darkvisionRadius: 0 },
    proficiencies: {
      armor: ['Armures légères'],
      weapons: ['wp-dague'],
      tools: [],
      savingThrows: ['Intelligence', 'Sagesse'],
      skills: ['Arcanes', 'Investigation'],
      expertiseSkills: [],
      languages: ['Arolave'],
      writingSystems: ['Cyrillan'],
    },
    features: [
      {
        refId: 'feat-test-unlimited',
        name: 'Trait test',
        desc: 'Capacité usage illimité.',
        source: 'class',
        sourceDetail: 'Test',
        level: 1,
        uses: { max: 99, current: 99, recharge: 'unlimited' },
      },
      {
        refId: 'feat-test-short',
        name: 'Repos court',
        desc: 'Capacité repos court.',
        source: 'class',
        level: 1,
        uses: { max: 2, current: 2, recharge: 'short_rest' },
      },
    ],
    equipment: [
      {
        instanceId: 'eq-1',
        refId: 'wp-dague',
        name: 'Dague',
        qty: 1,
        location: 'at_hand',
        equipped: true,
        wKg: 0.5,
      },
    ],
    currency: { or: 5, argent: 0, cuivre: 0, platine: 0 },
    carryCapacity: {
      maxKg: 75,
      currentKg: 1,
      encumberedAtKg: 50,
      heavilyEncumberedAtKg: 75,
      status: 'normal',
    },
    spellcasting: null,
    knownSpells: [],
    ammunition: [],
    notes: '',
    personality: {
      description: 'Description courte.',
      sex: 'X',
      background: 'Historique du personnage.',
      story: 'Une histoire assez longue pour tester le retour à la ligne sur la fiche PDF.',
      awakened: false,
      ideal: 'Justice',
      traits: 'Curieux',
      alignment: 'Loyal Bon',
      bonds: 'Sa famille',
      flaws: 'Impulsif',
      handicap: '',
      madness: '',
      corruption: { stage1: 0, stage2: 0, stage3: 0, stage4: 0 },
      backgroundId: 'bg-erudit',
    },
  };

  return { ...base, ...overrides };
}

export function createClericPdfCharacter(spellCount = 20): Character {
  const spellcasting: CharacterSpellcasting = {
    kind: 'cleric',
    ability: 'Sagesse',
    spellSaveDC: 13,
    spellAttackBonus: 5,
    focus: 'Symbole sacré',
    spellSlots: BASE_SPELL_SLOTS,
    cantrips: { max: 3, used: 3 },
    deity: 'Aurélios',
    domain: 'Vie',
    divineChannels: [
      {
        id: 'dc-turn',
        name: 'Repousser les morts-vivants',
        desc: 'Canalisation divine.',
        uses: { max: 1, current: 1 },
      },
    ],
  };

  return createMinimalCharacter({
    name: 'Prêtre Test',
    classes: [
      {
        classId: 'cls-pretre',
        classLabel: 'Prêtre',
        level: 5,
        hitDie: 8,
        subclassId: undefined,
        subclassLabel: undefined,
      },
    ],
    totalLevel: 5,
    spellcasting,
    knownSpells: makeSpellInstances(spellCount),
  });
}

export function createRangerPdfCharacter(): Character {
  const spellcasting: CharacterSpellcasting = {
    kind: 'ranger',
    ability: 'Sagesse',
    spellSaveDC: 12,
    spellAttackBonus: 4,
    focus: null,
    spellSlots: [{ level: 1, max: 2, used: 0 }],
    cantrips: { max: 0, used: 0 },
    knownSpellsCount: 2,
  };

  return createMinimalCharacter({
    name: 'Rôdeur Test',
    classes: [
      {
        classId: 'cls-rodeur',
        classLabel: 'Rôdeur',
        level: 2,
        hitDie: 10,
        subclassId: undefined,
        subclassLabel: undefined,
      },
    ],
    totalLevel: 2,
    spellcasting,
    knownSpells: makeSpellInstances(4, 100),
  });
}

/** JPEG 1×1 valide pour mocker le chargement d'images dans les tests PDF. */
export const TINY_JPEG_DATA_URL =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=';
