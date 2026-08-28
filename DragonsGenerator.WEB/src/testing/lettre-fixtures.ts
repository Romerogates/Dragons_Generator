import { normalizeCharacterClass } from '@core/utils/class-data.adapter';
import type { CharacterClass } from '@core/models/CharacterClasses/character-class';
import type { CharacterBuilderService } from '@core/services/character-builder.service';
import type { EquipmentSlot } from '@core/models/Character/character';

/** Classe Lettré normalisée (niv. 1) pour tests wizard. */
export function createLettreClass(): CharacterClass {
  return normalizeCharacterClass({
    id: 'cls-lettre',
    name: 'Lettré',
    data: {
      hit_die: '1d8',
      hp_at_level_1: 8,
      hp_per_level_average: 5,
      primary_abilities: ['int', 'wis'],
      saving_throw_proficiencies: ['int', 'wis'],
      armor_proficiencies: ['ar-light'],
      weapon_proficiencies: ['wp-dague', 'wp-baton-de-combat'],
      tool_proficiencies: [],
      choice_pools: [
        {
          id: 'choice-weapons-cls-lettre',
          name: 'Armes supplémentaires maîtrisées',
          type: 'weapon_proficiency',
          quantity: 2,
          pool: ['wp-any'],
          constraint_max_price_po: 25,
          unlocked_at_level: 1,
        },
        {
          id: 'choice-tools-cls-lettre',
          name: "Maîtrises d'outils",
          type: 'tool_proficiency',
          quantity: 3,
          pool: ['tl-any'],
          unlocked_at_level: 1,
        },
        {
          id: 'choice-astuces-initial-cls-lettre',
          name: 'Astuces initiales',
          type: 'feature_selection',
          quantity: 2,
          fixed_features: ['feat-astuce-empressement'],
          pool: [
            'feat-astuce-audace',
            'feat-astuce-brio',
            'feat-astuce-diversion',
            'feat-astuce-expedient',
          ],
          unlocked_at_level: 1,
        },
      ],
      starting_equipment: {
        fixed: [{ id: 'ar-armure-de-cuir', qty: 1 }],
        choice_pools: [
          {
            name: 'Équipement (slot 2)',
            options: [
              { option_id: 'A', items: [{ id: 'tl-mastered-choice', qty: 1 }] },
              { option_id: 'B', items: [{ id: 'wp-mastered-choice', qty: 1 }] },
            ],
          },
          {
            name: 'Équipement (slot 3)',
            options: [
              { option_id: 'A', items: [{ id: 'gr-sac-derudit', qty: 1 }] },
              { option_id: 'B', items: [{ id: 'gr-sac-daventurier', qty: 1 }] },
            ],
          },
        ],
      },
      progression: [{ level: 1, features: ['feat-astuces'] }],
      features_details: [
        {
          id: 'feat-astuce-audace',
          name: 'Audace',
          desc: 'Astuce test audace.',
          level: 1,
        },
        {
          id: 'feat-astuce-brio',
          name: 'Brio',
          desc: 'Astuce test brio.',
          level: 1,
        },
        {
          id: 'feat-astuce-diversion',
          name: 'Diversion',
          desc: 'Astuce test diversion.',
          level: 1,
        },
        {
          id: 'feat-astuce-expedient',
          name: 'Expédient',
          desc: 'Astuce test expédient.',
          level: 1,
        },
        {
          id: 'feat-astuce-empressement',
          name: 'Empressement',
          desc: 'Astuce fixe.',
          level: 1,
        },
      ],
    },
  } as any);
}

export const LETTRE_STARTING_SLOTS: EquipmentSlot[] = createLettreClass().data.starting_equipment;

/** Remplit le builder avec un Lettré niv. 1 prêt pour build/export. */
export function seedLettreBuilder(builder: CharacterBuilderService): void {
  builder.creation.update((c) => ({
    ...c,
    name: 'Tyrolienne',
    speciesId: 'spc-humain',
    speciesName: 'Humain',
    civilizationId: 'civ-ajagar',
    civilizationName: 'Ajagar',
    backgroundId: 'bg-erudit',
    backgroundName: 'Érudit',
    backgroundPreset: true,
    classId: 'cls-lettre',
    className: 'Lettré',
    hitDie: 8,
    hpAtLevel1: 8,
    hpPerLevelAverage: 5,
    targetLevel: 1,
    savingThrows: ['Intelligence', 'Sagesse'],
    armorProficiencies: ['Armures légères'],
    weaponProficiencies: [
      'wp-dague',
      'wp-baton-de-combat',
      'wp-epee-courte',
      'wp-arbalete-legere',
    ],
    toolProficiencies: ['tl-lyre', 'tl-des', 'tl-echecs'],
    startingEquipmentSlots: LETTRE_STARTING_SLOTS,
    selectedSkills: ['skill-arcanes', 'skill-histoire', 'skill-investigation'],
    classChoiceAnswers: {
      'choice-astuces-initial-cls-lettre': ['feat-astuce-audace', 'feat-astuce-brio'],
    },
    classFeatures: [
      {
        refId: 'feat-astuce-audace',
        name: 'Audace',
        desc: 'Astuce test audace.',
        source: 'class',
        sourceDetail: 'Lettré · Astuces initiales',
        level: 1,
      },
      {
        refId: 'feat-astuce-brio',
        name: 'Brio',
        desc: 'Astuce test brio.',
        source: 'class',
        sourceDetail: 'Lettré · Astuces initiales',
        level: 1,
      },
    ],
    selectedEquipment: [
      {
        instanceId: 'eq-armor-1',
        refId: 'ar-armure-de-cuir',
        name: 'Armure de cuir',
        qty: 1,
        location: 'equipped',
        equipped: true,
        wKg: 5,
        customData: { isArmor: true, ac: 11, subtype: 'LIGHT' },
      },
      {
        instanceId: 'eq-wp-1',
        refId: 'wp-dague',
        name: 'Dague',
        qty: 1,
        location: 'at_hand',
        equipped: false,
        wKg: 0.5,
        customData: {
          isWeapon: true,
          damage: '1d4',
          damageType: 'perforant',
          properties: ['prop-finesse'],
          subtype: 'SIMPLE_MELEE',
        },
      },
      {
        instanceId: 'eq-gear-1',
        refId: 'gr-sac-derudit',
        name: "Sac d'érudit",
        qty: 1,
        location: 'backpack',
        equipped: false,
        wKg: 2,
      },
    ],
  }));
}
