import { buildPregenPhysicalDescription } from './pregen-narrative.util';
import type { Character } from '@core/models/Character/character';

function base(sex: 'M' | 'F' | 'X' | undefined): Character {
  return {
    id: 'c1',
    name: 'Test',
    createdAt: '',
    updatedAt: '',
    schemaVersion: 1,
    species: { id: 'sp', label: 'Humain' },
    size: 'M',
    civilization: { id: 'civ', label: 'Ajagar' },
    backgroundRef: null,
    privilegeRef: null,
    classes: [{ classId: 'cls', classLabel: 'Guerrier', level: 1 }],
    totalLevel: 1,
    experience: 0,
    abilities: { force: 10, dexterite: 10, constitution: 10, intelligence: 10, sagesse: 10, charisme: 10 },
    abilityModifiers: { force: 0, dexterite: 0, constitution: 0, intelligence: 0, sagesse: 0, charisme: 0 },
    proficiencyBonus: 2,
    vitality: { maxHp: 10, currentHp: 10, tempHp: 0, hitDice: '1d10' },
    defense: { armorClass: 10 },
    initiative: 0,
    attacks: [],
    movement: { walk: 9 },
    senses: {},
    proficiencies: {
      armor: [],
      weapons: [],
      tools: [],
      skills: [],
      savingThrows: [],
      languages: [],
    },
    features: [],
    equipment: [],
    currency: { or: 0, argent: 0, cuivre: 0 },
    personality: { sex },
  } as unknown as Character;
}

describe('buildPregenPhysicalDescription', () => {
  it('conjugates for F / M / X / missing sex', () => {
    expect(buildPregenPhysicalDescription(base('F'), 'Humain', 'Guerrier')).toContain('Elle est');
    expect(buildPregenPhysicalDescription(base('M'), 'Humain', 'Guerrier')).toContain('Il est');
    expect(buildPregenPhysicalDescription(base('X'), 'Humain', 'Guerrier')).toContain('Iel est');
    expect(buildPregenPhysicalDescription(base(undefined), 'Elfes', 'Magicien')).toContain('Iel est');
  });
});
