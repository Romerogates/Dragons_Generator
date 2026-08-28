import {
  equipmentDescription,
  equipmentStatLines,
  equipmentSubtypeLabel,
  equipmentSummaryText,
  equipmentTypeLabel,
} from './equipment-display.util';
import {
  formatGameIds,
  labelForGameId,
  labelForItemRef,
  registerGameLabel,
  registerGameLabels,
} from './game-id-labels';
import {
  extractScalarResources,
  resolveFeatureUses,
} from './feature-uses.util';
import { annotateAuraDesc } from './aura-range.util';
import {
  abilityKeyToApiCode,
  apiAsiToPartialScores,
  apiCodeToAbilityKey,
  mergePartialScores,
} from './ability-mapping';
import {
  buildSkillMap,
  prettifySkillId,
  resolveSkillInfo,
  normalizeSkillId,
} from './skill.utils';
import {
  isEquipmentCategoryId,
  masteredProficiencyChoiceLabel,
  normalizeEquipment,
  normalizeItemRef,
} from './equipment.utils';

describe('branch coverage — equipment-display.util', () => {
  it('covers weapon range and armor dex branches', () => {
    const ranged = equipmentSummaryText({
      type: 'WEAPON',
      subtype: 'SIMPLE_RANGED',
      wKg: 2,
      cost: { v: 25, u: 'po' },
      data: {
        dmg_d: '1d8',
        damage_type: 'perforant',
        throw_range: { normal: 6, max: 18 },
        ammo_range: { normal: 24, max: 96 },
        str_req: 13,
      },
    });
    expect(ranged).toContain('Lancer 6/18 m');
    expect(ranged).toContain('For 13');
    expect(ranged).toContain('25 po');

    const thrownOnly = equipmentSummaryText({
      type: 'WEAPON',
      subtype: 'SIMPLE_MELEE',
      data: { dmg_d: '1d4', range: '5 m' },
    });
    expect(thrownOnly).toContain('5 m');

    const numericRange = equipmentSummaryText({
      type: 'WEAPON',
      subtype: 'MARTIAL_RANGED',
      data: { range: 30 },
    });
    expect(numericRange).toContain('Portée 30 m');

    const heavyArmor = equipmentSummaryText({
      type: 'ARMOR',
      subtype: 'HEAVY',
      data: {
        ac_base: 18,
        dex_modifier: false,
        stealth_disadvantage: true,
        str_required: 15,
      },
    });
    expect(heavyArmor).toContain('Dex non applicable');
    expect(heavyArmor).toContain('Discrétion −');

    const mediumArmor = equipmentSummaryText({
      type: 'ARMOR',
      subtype: 'MEDIUM',
      data: { ac: 14, dex_modifier: 'partial', max_dex_bonus: 2 },
    });
    expect(mediumArmor).toContain('Dex max +2');

    const lightArmor = equipmentSummaryText({
      type: 'ARMOR',
      subtype: 'LIGHT',
      data: { ac: 11, dex_modifier: 'full' },
    });
    expect(lightArmor).toContain('+ Dex complet');
  });

  it('covers labels, description and stat lines edge cases', () => {
    expect(equipmentTypeLabel('vehicle')).toBe('Véhicule');
    expect(equipmentTypeLabel('custom')).toBe('custom');
    expect(equipmentSubtypeLabel(null)).toBe('');
    expect(equipmentSubtypeLabel('UNKNOWN')).toBe('UNKNOWN');

    expect(equipmentDescription({ type: 'GEAR', subtype: null, data: { desc: '  ' } })).toBeNull();
    expect(
      equipmentDescription({ type: 'GEAR', subtype: null, data: { description: 'Note' } }),
    ).toBe('Note');

    const lines = equipmentStatLines({
      type: 'GEAR',
      subtype: null,
      wKg: 1,
      data: { desc: 'Détail' },
    });
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(lines[lines.length - 1]).toBe('Détail');
  });
});

describe('branch coverage — feature-uses.util', () => {
  it('covers recharge and formula branches', () => {
    expect(resolveFeatureUses({ recharge: 'passive' }, {}, 5)).toBeUndefined();

    const shortRest = resolveFeatureUses({ recharge: 'short_rest', uses: 2 }, {}, 3);
    expect(shortRest?.recharge).toBe('short_rest');

    const unlimited = resolveFeatureUses(
      { recharge: 'at_will', uses: { formula: 'proficiency_bonus' } },
      {},
      5,
      4,
    );
    expect(unlimited?.recharge).toBe('unlimited');
    expect(unlimited?.max).toBe(4);

    const cls = {
      data: {
        progression: [
          { level: 5, resources: { channel_divinity: 1 } },
          { level: 6, resources: { channel_divinity: 2 } },
        ],
      },
    };

    const baseUpgrade = resolveFeatureUses(
      {
        recharge: 'long_rest',
        uses: { base: 1, upgrades: [{ at_level: 6, value: 2 }] },
      },
      cls,
      6,
    );
    expect(baseUpgrade?.max).toBe(2);

    const perDay = resolveFeatureUses({ recharge: 'long_rest', uses: { per_day: 3 } }, cls, 5);
    expect(perDay?.max).toBe(3);

    const perRest = resolveFeatureUses({ recharge: 'short_rest', uses: { per_rest: 1 } }, cls, 5);
    expect(perRest?.max).toBe(1);

    const tableFormula = resolveFeatureUses(
      { recharge: 'long_rest', uses: { formula: 'table:channel_divinity' } },
      cls,
      6,
    );
    expect(tableFormula?.max).toBe(2);

    const paladin = resolveFeatureUses(
      { recharge: 'long_rest', uses: { formula: 'paladin_level*5' } },
      cls,
      4,
    );
    expect(paladin?.max).toBe(20);

    const sorcerer = resolveFeatureUses(
      { recharge: 'long_rest', uses: { formula: 'sorcerer_level' } },
      cls,
      7,
    );
    expect(sorcerer?.max).toBe(7);

    const numericFormula = resolveFeatureUses(
      { recharge: 'long_rest', uses: { formula: '3' } },
      cls,
      5,
    );
    expect(numericFormula?.max).toBe(3);

    const conduit = resolveFeatureUses(
      {
        rechargeType: 'special',
        recharge: 'long_rest',
        mechanics: {
          uses_key: 'channel_divinity',
          upgrades: [{ at_level: 6, uses: 2 }],
        },
      },
      { data: { progression: [{ level: 5, resources: {} }] } },
      6,
    );
    expect(conduit?.max).toBe(2);

    expect(extractScalarResources(undefined)).toEqual({});
    expect(extractScalarResources({ label: null })).toEqual({ label: null });
  });
});

describe('branch coverage — game-id-labels', () => {
  it('covers null, skill alias, slug and format helpers', () => {
    expect(labelForGameId(null)).toBe('—');
    expect(labelForGameId('')).toBe('—');
    expect(formatGameIds(null)).toBe('—');
    expect(formatGameIds([])).toBe('—');
    expect(labelForItemRef(null)).toBe('—');
    expect(labelForItemRef('wp-dague')).toContain('Dague');
    expect(labelForItemRef({ id: 'wp-dague', qty: 1 })).toBe('Dague');
    expect(labelForItemRef({ id: 'wp-dague', qty: 2 })).toBe('2× Dague');

    registerGameLabel('', '');
    registerGameLabel('ski-athletisme', 'Athlétisme API');
    registerGameLabels([['eq-custom', 'Objet custom']]);
    expect(labelForGameId('ski-athletisme')).toBe('Athlétisme API');
    expect(labelForGameId('eq-custom')).toBe('Objet custom');
    expect(labelForGameId('wp-arbalete-legere')).toContain('Arbalète');
    expect(labelForGameId('category-unknown-foo-bar')).toBeTruthy();
  });
});

describe('branch coverage — ability-mapping & skill.utils', () => {
  it('maps abilities and merges partial scores', () => {
    expect(apiCodeToAbilityKey('STR')).toBe('force');
    expect(apiCodeToAbilityKey('unknown')).toBeNull();
    expect(abilityKeyToApiCode('charisme')).toBe('cha');
    expect(apiAsiToPartialScores(null)).toEqual({});
    expect(apiAsiToPartialScores({ str: 2, bad: 1, cha: 0 })).toEqual({ force: 2 });
    expect(mergePartialScores({ force: 2 }, { force: 1, charisme: 1 })).toEqual({
      force: 3,
      charisme: 1,
    });
  });

  it('builds skill map and resolves unknown ids', () => {
    const map = buildSkillMap([
      { id: 'ski-athletisme', name: 'Athlétisme', ability: 'FOR' } as any,
      { id: 'skill-custom', name: 'Custom', ability: 'unknown' } as any,
    ]);
    expect(normalizeSkillId('ski-perception')).toBe('skill-perception');
    expect(map['skill-athletisme'].ability).toBe('Force');
    expect(map['skill-custom'].icon).toBe('fluent-emoji:bookmark-tabs');
    expect(prettifySkillId('skill-survie', map)).toBe('Survie');
    expect(resolveSkillInfo('ski-athletisme', map)?.label).toBe('Athlétisme');
  });
});

describe('branch coverage — aura-range & equipment.utils', () => {
  it('returns base desc when mechanics invalid', () => {
    expect(annotateAuraDesc({ desc: 'Aura.' }, 5)).toBe('Aura.');
    expect(
      annotateAuraDesc({ desc: "Portée d'aura : 3 m.", mechanics: { range_m_initial: 3 } }, 5),
    ).toBe("Portée d'aura : 3 m.");
    expect(annotateAuraDesc({ mechanics: { range_m_initial: 0 } }, 5)).toBe('');
  });

  it('covers normalize and category edge cases', () => {
    expect(normalizeItemRef({ qty: 2 })).toEqual({ id: 'unknown', qty: 1 });
    expect(normalizeItemRef('wp-dague-x3')).toEqual({ id: 'wp-dague', qty: 3 });
    expect(isEquipmentCategoryId('category-custom')).toBe(true);
    expect(masteredProficiencyChoiceLabel('unknown')).toBe('Choix');

    const normalized = normalizeEquipment({
      id: 'ar-shield',
      name: 'Bouclier',
      type: 'armor',
      subtype: 'shield',
      cost: { value: 10, unit: 'po' } as any,
      wKg: null,
      data: {
        ac_base: 2,
        stealth_disadvantage: true,
        str_required: null,
      },
    } as any);
    expect(normalized.subtype).toBe('SHIELD');
    expect((normalized.data as unknown as Record<string, unknown>)['stealth_dis']).toBeTrue();
  });
});
