import {
  buildMechanicsBlocks,
  buildOptionBlocks,
  prettyOptionId,
} from './species-mechanics.util';

describe('species-mechanics.util', () => {
  it('formats drakeide breath weapon progression', () => {
    const blocks = buildMechanicsBlocks({
      type: 'breath_weapon',
      action_type: 'action',
      recharge: 'short_or_long_rest',
      save: { dc_formula: '8 + bonus' },
      damage_progression: [{ unlocks_at_level: 1, dice: { quantity: 2, faces: 6, modifier: 0 } }],
    });
    expect(blocks[0]?.title).toBe('Souffle draconique');
    expect(blocks[0]?.rows.some((r) => r.label.includes('Niveau 1'))).toBeTrue();
  });

  it('formats dragon lineage options as cards', () => {
    const blocks = buildOptionBlocks(
      [
        {
          id: 'drag-rouge',
          name: 'Rouge',
          damage_type: 'damage-feu',
          breath_area: { shape: 'cone', length_m: 4.5 },
          save_ability: 'dex',
        },
      ],
      'dragon_lineage',
    );
    expect(blocks[0]?.title).toBe('Rouge');
    expect(blocks[0]?.rows.some((r) => r.label === 'Dégâts')).toBeTrue();
    expect(blocks[0]?.badges).toContain('Feu');
  });

  it('prettyOptionId maps ability codes', () => {
    expect(prettyOptionId('str')).toBe('Force');
    expect(prettyOptionId('drag-bleu', 'dragon_lineage')).toBe('Bleu');
  });
});
