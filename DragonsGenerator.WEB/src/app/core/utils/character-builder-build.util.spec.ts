import { buildCharacterFromCreation } from './character-build.util';
import type { AbilityScores, CharacterCreation, EquipmentInstance } from '@core/models/Character/character';
import {
  buildCharacterAttacks,
  computeCharacterArmorClass,
  computeCharacterWalkSpeed,
  findEquippedArmorName,
  isMonkWeapon,
  pickHigherDie,
} from './character-combat.util';
import { proficiencyBonusForLevel } from './character-progression.util';
import { INITIAL_CREATION_STATE } from '@core/models/Character/character-builder.types';
import {
  buildCharacterSpellcasting,
  buildKnownSpellsFromCreation,
  detectSpellcastingFocus,
  spellSlotsForCharacterLevel,
} from './character-spellcasting.util';

const mods: AbilityScores = {
  force: 2,
  dexterite: 3,
  constitution: 1,
  intelligence: 0,
  sagesse: 1,
  charisme: -1,
};

function weapon(refId: string, name: string, extra: Partial<EquipmentInstance> = {}): EquipmentInstance {
  return {
    instanceId: refId,
    refId,
    name,
    qty: 1,
    equipped: true,
    location: 'equipped',
    wKg: 1,
    customData: {
      isWeapon: true,
      damage: '1d8',
      damageType: 'tranchant',
      properties: ['Polyvalente'],
      ...((extra.customData as object) ?? {}),
    },
    ...extra,
  };
}

describe('character-progression.util', () => {
  it('proficiencyBonusForLevel follows D&D tiers', () => {
    expect(proficiencyBonusForLevel(1)).toBe(2);
    expect(proficiencyBonusForLevel(5)).toBe(3);
    expect(proficiencyBonusForLevel(20)).toBe(6);
  });
});

describe('character-combat.util', () => {
  it('pickHigherDie prefers higher average', () => {
    expect(pickHigherDie('1d4', '1d8')).toBe('1d8');
  });

  it('computeCharacterArmorClass uses unarmored barbarian', () => {
    const ac = computeCharacterArmorClass([], mods, {
      classId: 'cls-barbare',
      classFeatures: [],
    });
    expect(ac).toBe(10 + mods.dexterite + mods.constitution);
  });

  it('computeCharacterArmorClass adds shield for armored fighter', () => {
    const armor: EquipmentInstance = {
      instanceId: 'a1',
      refId: 'ar-cotte',
      name: 'Cotte',
      qty: 1,
      equipped: true,
      location: 'equipped',
      wKg: 10,
      customData: { isArmor: true, ac: 14, dexModifier: { type: 'max', max: 2 } },
    };
    const shield: EquipmentInstance = {
      instanceId: 's1',
      refId: 'ar-bouclier',
      name: 'Bouclier',
      qty: 1,
      equipped: true,
      location: 'equipped',
      wKg: 3,
      customData: { isShield: true, ac: 2 },
    };
    const ac = computeCharacterArmorClass([armor, shield], mods, { classId: 'cls-guerrier' });
    expect(ac).toBe(14 + Math.min(mods.dexterite, 2) + 2);
  });

  it('buildCharacterAttacks includes monk unarmed strike', () => {
    const attacks = buildCharacterAttacks([], mods, 2, [], {
      classId: 'cls-moine',
      resources: { martial_arts_die: '1d6', extra_attacks: 1 },
    });
    expect(attacks.some((a) => a.name === 'Mains nues')).toBeTrue();
  });

  it('isMonkWeapon accepts short sword ids', () => {
    expect(isMonkWeapon({ refId: 'wp-epee-courte', name: 'Épée courte' } as EquipmentInstance, [], null)).toBeTrue();
  });

  it('computeCharacterWalkSpeed adds monk bonus without armor', () => {
    const c = {
      speciesSpeed: 9,
      classId: 'cls-moine',
      classFeatures: [],
      classProgressionResources: { unarmored_movement_bonus_m: 3 },
    } as unknown as CharacterCreation;
    expect(computeCharacterWalkSpeed(c, [])).toBe(12);
  });

  it('findEquippedArmorName returns fallback', () => {
    expect(findEquippedArmorName([])).toBe('Aucune');
  });
});

describe('character-spellcasting.util', () => {
  it('buildKnownSpellsFromCreation maps cantrips and spells', () => {
    const c = {
      selectedEquipment: [],
      backgroundEquipment: [],
      spellcastingDetails: {
        cantrips: [{ refId: 'spl-a', name: 'Flamme', level: 0, prepared: true }],
        spells: [{ refId: 'spl-b', name: 'Bouclier', level: 1, prepared: false }],
      },
    } as unknown as CharacterCreation;
    const list = buildKnownSpellsFromCreation(c);
    expect(list.length).toBe(2);
    expect(list[1].prepared).toBeFalse();
  });

  it('detectSpellcastingFocus finds arcane focus in equipment', () => {
    const c = {
      selectedEquipment: [{ refId: 'eq-focus', name: 'Baguette arcanique', qty: 1 }],
      backgroundEquipment: [],
    } as unknown as CharacterCreation;
    expect(detectSpellcastingFocus(c)).toBe('Baguette arcanique');
  });

  it('spellSlotsForCharacterLevel returns warlock pact slots', () => {
    const slots = spellSlotsForCharacterLevel('warlock', 5);
    expect(slots).toEqual([{ level: 3, max: 2 }]);
  });

  it('spellSlotsForCharacterLevel uses json override when provided', () => {
    const slots = spellSlotsForCharacterLevel('wizard', 3, [{ level: 1, max: 99 }]);
    expect(slots).toEqual([{ level: 1, max: 99 }]);
  });

  it('buildCharacterSpellcasting builds wizard block', () => {
    const c = {
      hasSpellcasting: true,
      spellcastingKind: 'wizard',
      spellcastingAbility: 'Intelligence',
      targetLevel: 5,
      subclassName: 'Évocation',
      spellMasteryPicks: { '2': 'spl-magic-missile' },
      signatureSpellIds: ['spl-shield'],
      selectedEquipment: [],
      backgroundEquipment: [],
      spellcastingDetails: {
        cantrips: [{ refId: 'spl-light', name: 'Lumière' }],
        spellMastery: [{ spellLevel: 2, spellId: 'spl-magic-missile', spellName: 'Projectile magique' }],
      },
      classProgressionResources: {},
    } as unknown as CharacterCreation;
    const sc = buildCharacterSpellcasting(c, mods);
    expect(sc?.kind).toBe('wizard');
    expect(sc?.spellSaveDC).toBe(8 + 3 + mods.intelligence);
    if (sc?.kind === 'wizard') {
      expect(sc.arcaneTradition).toBe('Évocation');
    }
  });

  it('buildCharacterSpellcasting builds sorcerer metamagic labels', () => {
    const c = {
      hasSpellcasting: true,
      spellcastingKind: 'sorcerer',
      spellcastingAbility: 'Charisme',
      targetLevel: 3,
      subclassName: 'Lignée draconique',
      metamagicOptions: ['meta-subtle-spell'],
      selectedEquipment: [],
      backgroundEquipment: [],
      spellcastingDetails: { cantrips: [] },
      classProgressionResources: { arcane_points: 3 },
    } as unknown as CharacterCreation;
    const sc = buildCharacterSpellcasting(c, mods);
    expect(sc?.kind).toBe('sorcerer');
    expect((sc as { metamagic?: string[] }).metamagic?.length).toBe(1);
  });
});

describe('character-build.util', () => {
  it('buildCharacterFromCreation preserves editing metadata and core fields', () => {
    const creation = structuredClone(INITIAL_CREATION_STATE);
    creation.name = 'Testeur';
    creation.speciesId = 'spc-humain';
    creation.speciesName = 'Humain';
    creation.civilizationId = 'civ-nordique';
    creation.civilizationName = 'Nordique';
    creation.classId = 'cls-guerrier';
    creation.className = 'Guerrier';
    creation.hitDie = 10;
    creation.targetLevel = 3;

    const abilities = {
      force: 16,
      dexterite: 12,
      constitution: 14,
      intelligence: 10,
      sagesse: 10,
      charisme: 8,
    };
    const modifiers = {
      force: 3,
      dexterite: 1,
      constitution: 2,
      intelligence: 0,
      sagesse: 0,
      charisme: -1,
    };

    const character = buildCharacterFromCreation({
      creation,
      abilities,
      modifiers,
      hpMax: 28,
      proficiencyBonus: proficiencyBonusForLevel(3),
      targetLevel: 3,
      passivePerception: 12,
      editing: {
        id: 'edit-id-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        cloudSynced: true,
      },
      now: '2026-09-02T00:00:00.000Z',
    });

    expect(character.id).toBe('edit-id-1');
    expect(character.cloudSynced).toBeTrue();
    expect(character.name).toBe('Testeur');
    expect(character.totalLevel).toBe(3);
    expect(character.classes[0].classLabel).toBe('Guerrier');
    expect(character.vitality.hitPointsMax).toBe(28);
    expect(character.updatedAt).toBe('2026-09-02T00:00:00.000Z');
  });

  it('merges species resistances/darkvision with class-granted resistances and blindsight', () => {
    const creation = structuredClone(INITIAL_CREATION_STATE);
    creation.name = 'Rôdeur test';
    creation.speciesId = 'spc-elfe';
    creation.speciesName = 'Elfe';
    creation.speciesResistances = ['charme'];
    creation.hasDarkvision = true;
    creation.darkvisionRadius = 18;
    creation.civilizationId = 'civ-nordique';
    creation.civilizationName = 'Nordique';
    creation.classId = 'cls-rodeur';
    creation.className = 'Rôdeur';
    creation.hitDie = 10;
    creation.targetLevel = 18;
    // Bonus de classe/sous-classe calculés par class-step.ts (subclassBonusResistances,
    // classBonusSenses) — ici on simule directement l'état persisté par le wizard.
    creation.classResistances = ['psychic'];
    creation.classDarkvisionRadius = 0;
    creation.classHasBlindsight = true;
    creation.classBlindsightRadius = 9;

    const abilities = {
      force: 10,
      dexterite: 16,
      constitution: 14,
      intelligence: 10,
      sagesse: 14,
      charisme: 8,
    };
    const modifiers = {
      force: 0,
      dexterite: 3,
      constitution: 2,
      intelligence: 0,
      sagesse: 2,
      charisme: -1,
    };

    const character = buildCharacterFromCreation({
      creation,
      abilities,
      modifiers,
      hpMax: 120,
      proficiencyBonus: proficiencyBonusForLevel(18),
      targetLevel: 18,
      passivePerception: 16,
      editing: { id: 'edit-id-2', createdAt: '2026-01-01T00:00:00.000Z', cloudSynced: false },
      now: '2026-09-03T00:00:00.000Z',
    });

    expect(character.defense.resistances).toEqual(['charme', 'psychic']);
    expect(character.senses.hasDarkvision).toBeTrue();
    expect(character.senses.darkvisionRadius).toBe(18);
    expect(character.senses.hasBlindsight).toBeTrue();
    expect(character.senses.blindsightRadius).toBe(9);
  });

  it('multiclassage (RAW) : fusionne classes/PV/maîtrises/emplacements de sorts des classes secondaires', () => {
    const creation = structuredClone(INITIAL_CREATION_STATE);
    creation.name = 'Multiclasse test';
    creation.speciesId = 'spc-humain';
    creation.speciesName = 'Humain';
    creation.civilizationId = 'civ-nordique';
    creation.civilizationName = 'Nordique';
    creation.classId = 'cls-magicien';
    creation.className = 'Magicien';
    creation.hitDie = 6;
    creation.targetLevel = 3;
    creation.armorProficiencies = [];
    creation.weaponProficiencies = ['wp-dague'];
    creation.toolProficiencies = [];
    creation.hasSpellcasting = true;
    creation.spellcastingKind = 'wizard';
    creation.spellcastingAbility = 'Intelligence';
    creation.secondaryClasses = [
      {
        classId: 'cls-guerrier',
        className: 'Guerrier',
        subclassId: null,
        subclassName: null,
        level: 2,
        hitDie: 10,
        hpPerLevelAverage: 6,
        hasSpellcasting: false,
        spellcastingKind: null,
        spellcastingAbility: null,
        armorProficiencies: ['ar-light', 'ar-medium', 'ar-shield'],
        weaponProficiencies: ['wp-cat-simple', 'wp-cat-martial'],
        toolProficiencies: [],
        skillChooseCount: 0,
        skillOptions: [],
        classFeatures: [
          {
            refId: 'feat-second-souffle',
            name: 'Second souffle',
            desc: 'Test',
            source: 'class',
            sourceDetail: 'Guerrier 1',
            level: 1,
          },
        ],
      },
    ];

    const abilities = {
      force: 12,
      dexterite: 12,
      constitution: 14,
      intelligence: 16,
      sagesse: 10,
      charisme: 8,
    };
    const modifiers = {
      force: 1,
      dexterite: 1,
      constitution: 2,
      intelligence: 3,
      sagesse: 0,
      charisme: -1,
    };

    const character = buildCharacterFromCreation({
      creation,
      abilities,
      modifiers,
      hpMax: 42,
      proficiencyBonus: proficiencyBonusForLevel(5),
      targetLevel: 3,
      passivePerception: 10,
      editing: { id: 'edit-multi-1', createdAt: '2026-01-01T00:00:00.000Z', cloudSynced: false },
      now: '2026-09-04T00:00:00.000Z',
    });

    // Niveau total = classe primaire (3) + classe secondaire (2).
    expect(character.totalLevel).toBe(5);
    expect(character.classes.length).toBe(2);
    expect(character.classes[0].classLabel).toBe('Magicien');
    expect(character.classes[1]).toEqual(
      jasmine.objectContaining({ classLabel: 'Guerrier', level: 2, hitDie: 10 }),
    );

    // Dés de vie groupés par type (1×d6 classe primaire + 1×d10 classe secondaire).
    expect(character.vitality.hitDice).toEqual(
      jasmine.arrayContaining([
        jasmine.objectContaining({ dieType: 6, total: 3 }),
        jasmine.objectContaining({ dieType: 10, total: 2 }),
      ]),
    );

    // Maîtrises réduites de multiclassage unionnées aux maîtrises de la classe primaire.
    expect(character.proficiencies.armor).toEqual(['ar-light', 'ar-medium', 'ar-shield']);
    expect(character.proficiencies.weapons).toEqual(
      jasmine.arrayContaining(['wp-dague', 'wp-cat-simple', 'wp-cat-martial']),
    );

    // Aptitudes de la classe secondaire fusionnées dans les features du personnage.
    expect(character.features.some((f) => f.refId === 'feat-second-souffle')).toBeTrue();

    // Niveau de lanceur combiné = 3 (Magicien plein lanceur) + 0 (Guerrier non lanceur) = 3 →
    // emplacements de sorts niveau 1/2 de la table multiclasse standard.
    const sc = character.spellcasting as { spellSlots?: { level: number; max: number; used: number }[] } | null;
    expect(sc?.spellSlots).toEqual([
      { level: 1, max: 4, used: 0 },
      { level: 2, max: 2, used: 0 },
    ]);
  });
});
