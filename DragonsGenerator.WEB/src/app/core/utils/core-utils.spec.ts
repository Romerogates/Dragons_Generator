import { annotateAuraDesc } from './aura-range.util';
import { extractScalarResources, resolveFeatureUses } from './feature-uses.util';
import { labelForGameId, formatGameIds, labelForItemRef } from './game-id-labels';

describe('aura-range.util', () => {
  it('annotates aura range at base level', () => {
    const desc = annotateAuraDesc(
      { desc: 'Aura.', mechanics: { range_m_initial: 3, range_m_improved: 9, range_improves_at_level: 18 } },
      5,
    );
    expect(desc).toContain("Portée d'aura : 3 m");
  });

  it('uses improved range at high level', () => {
    const desc = annotateAuraDesc(
      { desc: 'Aura.', mechanics: { range_m_initial: 3, range_m_improved: 9, range_improves_at_level: 18 } },
      18,
    );
    expect(desc).toContain("Portée d'aura : 9 m");
  });
});

describe('feature-uses.util', () => {
  it('extractScalarResources filters nested objects', () => {
    const out = extractScalarResources({ rage: 2, nested: { x: 1 }, label: 'foo' });
    expect(out['rage']).toBe(2);
    expect(out['label']).toBe('foo');
    expect('nested' in out).toBe(false);
  });

  it('resolveFeatureUses from numeric uses', () => {
    const uses = resolveFeatureUses({ recharge: 'long_rest', uses: 3 }, {}, 5);
    expect(uses?.max).toBe(3);
    expect(uses?.current).toBe(3);
    expect(uses?.recharge).toBe('long_rest');
  });

  it('resolveFeatureUses from proficiency formula', () => {
    const uses = resolveFeatureUses(
      { recharge: 'short_rest', uses: { formula: 'proficiency_bonus' } },
      {},
      5,
      3,
    );
    expect(uses?.max).toBe(3);
  });

  it('resolveFeatureUses unlimited when null_means_unlimited', () => {
    const cls = { data: { progression: [{ level: 5, resources: { rage: null } }] } };
    const uses = resolveFeatureUses(
      { recharge: 'long_rest', uses: { source_column: 'rage', null_means_unlimited: true } },
      cls,
      5,
    );
    expect(uses?.recharge).toBe('unlimited');
    expect(uses?.max).toBe(99);
  });

  it('resolveFeatureUses monk ki from progression table', () => {
    const cls = { data: { progression: [{ level: 5, resources: { ki_points: 5 } }] } };
    const uses = resolveFeatureUses({ id: 'feat-ki', recharge: 'short_rest' }, cls, 5);
    expect(uses?.max).toBe(5);
  });
});

describe('game-id-labels', () => {
  it('labelForGameId resolves known ids', () => {
    expect(labelForGameId('ar-light')).toContain('lég');
    expect(labelForGameId('wp-cat-martial')).toContain('guerre');
    expect(labelForGameId('wp-dague')).toBe('Dague');
  });

  it('formatGameIds joins labels', () => {
    const text = formatGameIds(['ar-light', 'ar-shield']);
    expect(text).toContain(',');
  });

  it('labelForItemRef handles qty and aliases', () => {
    expect(labelForItemRef({ id: 'gr-sac-derudit', qty: 1 })).toContain('Sac');
    expect(labelForItemRef({ id: 'wp-dague', qty: 3 })).toMatch(/3/);
  });
});
