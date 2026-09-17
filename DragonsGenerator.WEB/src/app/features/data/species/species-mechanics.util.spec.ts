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

  it('labels dragon_lineage resistance source in French', () => {
    const blocks = buildMechanicsBlocks({
      type: 'damage_resistance',
      source_key: 'dragon_lineage',
      resistances: ['from_lineage'],
    });
    expect(blocks[0]?.rows).toEqual([
      { label: 'Source', value: 'Lignée draconique' },
      { label: 'Types', value: 'Selon la lignée draconique' },
    ]);
  });

  it('humanizes choice-lignee-draconique and skill hyphen ids', () => {
    const lineage = buildMechanicsBlocks({
      type: 'lineage_selection',
      resolved_by_choice: 'choice-lignee-draconique',
    });
    expect(lineage[0]?.rows[0]?.value).toBe('Lignée draconique');

    const ctx = buildMechanicsBlocks({
      type: 'context_check',
      skill: 'skill-artefacts-des-anciens',
      ability: 'int',
      trigger: 'inspecting_relics',
    });
    expect(ctx[0]?.rows.find((r) => r.label === 'Compétence')?.value).toBe('Artefacts Des Anciens');
  });

  it('prettyOptionId maps lg- language ids without raw prefix', () => {
    expect(prettyOptionId('lg-commun')).toBe('Commun');
    expect(prettyOptionId('lg-draconique')).toBe('Draconique');
  });
});
