import { normalizeBackground } from './background-data.adapter';
import { normalizeCharacterClass } from './class-data.adapter';
import { getClassIcon } from './class-icons';
import { equipmentSummaryText, equipmentStatLines, equipmentTypeLabel, equipmentSubtypeLabel } from './equipment-display.util';

describe('class-data.adapter', () => {
  it('normalizes schema 3.0 class JSON for wizard', () => {
    const normalized = normalizeCharacterClass({
      id: 'cls-lettre',
      name: 'Lettré',
      data: {
        hit_die: '1d8',
        primary_abilities: ['int', 'wis'],
        saving_throw_proficiencies: ['int', 'wis'],
        armor_proficiencies: ['ar-light'],
        weapon_proficiencies: ['wp-dague'],
        tool_proficiencies: [],
        choice_pools: [
          {
            type: 'skill_proficiency',
            quantity: 3,
            pool: ['skill-any'],
          },
        ],
        starting_equipment: {
          fixed: [{ id: 'ar-armure-de-cuir', qty: 1 }],
          choice_pools: [
            {
              name: 'Slot 2',
              options: [
                { option_id: 'A', items: [{ id: 'tl-mastered-choice', qty: 1 }] },
                { option_id: 'B', items: [{ id: 'wp-mastered-choice', qty: 1 }] },
              ],
            },
          ],
        },
        features_details: [],
      },
    } as any);

    expect(normalized.data.hit_die).toBe(8);
    expect(normalized.data.proficiencies.saving_throws).toContain('Intelligence');
    expect(normalized.data.starting_equipment.length).toBeGreaterThan(1);
  });

  it('normalizes subclass dragon_ancestry choice_pools to string option ids', () => {
    const normalized = normalizeCharacterClass({
      id: 'cls-ensorceleur',
      name: 'Ensorceleur',
      data: {
        hit_die: '1d6',
        primary_abilities: ['cha'],
        saving_throw_proficiencies: ['con', 'cha'],
        armor_proficiencies: [],
        weapon_proficiencies: [],
        tool_proficiencies: [],
        choice_pools: [],
        starting_equipment: { fixed: [], choice_pools: [] },
        features_details: [],
        subclasses: {
          name: 'Atavisme',
          level_unlocked: 1,
          options: [
            {
              id: 'subcls-lignee-draconique',
              name: 'Lignée draconique',
              flavor: { summary: 'Magie draconique.' },
              choice_pools: [
                {
                  id: 'choice-ancetre-draconique',
                  name: 'Ancêtre draconique',
                  type: 'dragon_ancestry',
                  quantity: 1,
                  pool: [
                    { id: 'dragon-rouge', damage_type: 'feu' },
                    { id: 'dragon-bleu', damage_type: 'foudre' },
                  ],
                },
              ],
              features_details: [],
            },
          ],
        },
      },
    } as any);

    const sub = (normalized.data.subclasses as { options: { sub_choices?: { options: string[] }[] }[] })
      .options[0];
    expect(sub.sub_choices?.length).toBe(1);
    expect(sub.sub_choices?.[0].options).toEqual(['dragon-rouge', 'dragon-bleu']);
  });

  it('maps roublard equipment choice_pools from root choice_pools', () => {
    const normalized = normalizeCharacterClass({
      id: 'cls-roublard',
      name: 'Roublard',
      data: {
        hit_die: '1d8',
        choice_pools: [
          {
            id: 'choice-equipment-1-cls-roublard',
            name: 'Arme principale',
            type: 'equipment',
            pool: [
              { option_id: 'opt-a', items: [{ id: 'wp-rapiere', qty: 1 }] },
              { option_id: 'opt-b', items: [{ id: 'wp-epee-courte', qty: 1 }] },
            ],
          },
        ],
        starting_equipment: { fixed: [], choice_pools: [] },
      },
    } as any);

    expect(normalized.data.starting_equipment.length).toBe(1);
    expect(normalized.data.starting_equipment[0].alternatives?.length).toBe(2);
  });
});

describe('background-data.adapter', () => {
  it('normalizes tool category choices', () => {
    const bg = normalizeBackground({
      id: 'bg-bohemien',
      name: 'Bohémien',
      data: {
        proficiencies: {
          skills: { fixed: [], choose: { count: 2, options: ['skill-survie'] } },
          tools: {
            fixed: [],
            choose: {
              count: 1,
              options: [{ type: 'tool_category', category: 'instrument', name: 'Instrument' }],
            },
          },
          languages: { fixed: [], choose_count: 1 },
        },
        equipment: { fixed: [], choose: [], currency: { or: 5 } },
        privilege: { id: 'priv-test', name: 'Test', desc: 'x' },
      },
    } as any);

    const choose = bg.data.proficiencies.tools.choose;
    expect(choose?.length).toBe(1);
    const firstOpt = choose?.[0]?.options?.[0];
    expect(firstOpt?.any).toBe(true);
    expect(firstOpt?.type).toBe('instrument');
  });

  it('normalizes class with subclass array shape', () => {
    const normalized = normalizeCharacterClass({
      id: 'cls-test',
      name: 'Test',
      data: {
        hit_die: '1d8',
        primary_abilities: ['int'],
        saving_throw_proficiencies: ['int'],
        armor_proficiencies: [],
        weapon_proficiencies: [],
        tool_proficiencies: [],
        choice_pools: [],
        starting_equipment: { fixed: [], choice_pools: [] },
        features_details: [],
        subclasses: [
          {
            id: 'sub-a',
            name: 'Voie A',
            flavor: { summary: 'Desc A' },
            features_details: [{ id: 'feat-a', name: 'A', desc: 'x' }],
            choice_pools: [],
          },
        ],
      },
    } as any);
    const subs = normalized.data.subclasses;
    expect(Array.isArray(subs)).toBeTrue();
    expect((subs as { id: string }[])[0]?.id).toBe('sub-a');
  });
});

describe('class-icons', () => {
  it('returns icon for known class or default', () => {
    expect(getClassIcon('cls-barde')).toContain('emoji');
    expect(getClassIcon('cls-unknown')).toBeTruthy();
  });
});

describe('equipment-display.util', () => {
  it('formats weapon summary line', () => {
    const line = equipmentSummaryText({
      type: 'WEAPON',
      subtype: 'SIMPLE_MELEE',
      wKg: 0.5,
      data: { dmg_d: '1d4', dmg_t: 'perforant', props: ['prop-finesse'] },
    });
    expect(line).toContain('1d4');
    expect(line).toContain('perforant');
  });

  it('formats armor summary and stat lines', () => {
    const eq = {
      type: 'ARMOR',
      subtype: 'LIGHT',
      data: { ac: 11, stealth_dis: true, desc: 'Légère' },
    };
    const summary = equipmentSummaryText(eq);
    expect(summary).toContain('CA 11');
    expect(equipmentStatLines(eq).length).toBe(2);
    expect(equipmentTypeLabel('weapon')).toBe('Arme');
    expect(equipmentSubtypeLabel('MARTIAL_MELEE')).toContain('Guerre');
  });
});
