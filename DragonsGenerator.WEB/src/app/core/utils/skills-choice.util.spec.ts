import {
  backgroundToolCategoryGroupLabel,
  normalizeBackgroundToolOption,
  toggleSkillIdInList,
} from './skills-choice.util';

describe('skills-choice.util', () => {
  it('normalise catégories et ids catalogue', () => {
    expect(normalizeBackgroundToolOption('instrument')).toEqual({ type: 'instrument', any: true });
    expect(normalizeBackgroundToolOption('tool')).toEqual({ type: 'tool', any: true });
    expect(normalizeBackgroundToolOption('artisan')).toEqual({ type: 'tool', any: true });
    expect(normalizeBackgroundToolOption('game_set')).toEqual({ type: 'gameSet', any: true });
    expect(normalizeBackgroundToolOption('jeu')).toEqual({ type: 'gameSet', any: true });
    expect(normalizeBackgroundToolOption('vehicle')).toEqual({ type: 'vehicle', any: true });
    expect(normalizeBackgroundToolOption('tl-outils-dalchimiste')).toEqual({
      type: 'tool',
      id: 'tl-necessaire-dalchimiste',
    });
    expect(normalizeBackgroundToolOption('tl-luth')).toEqual({ type: 'tool', id: 'tl-luth', any: false });
    expect(normalizeBackgroundToolOption('vhc-charrette')).toEqual({ type: 'tool', id: 'vhc-charrette', any: false });
    expect(normalizeBackgroundToolOption('marteau')).toEqual({ type: 'tool', id: 'marteau', any: false });
    expect(normalizeBackgroundToolOption({ type: 'tool', any: true })).toEqual({ type: 'tool', any: true });
    expect(normalizeBackgroundToolOption({ type: 'tool_category', category: 'vehicles' })).toEqual({
      type: 'vehicle',
      any: true,
    });
    expect(normalizeBackgroundToolOption({ type: 'tool_category', id: 'instruments' })).toEqual({
      type: 'instrument',
      any: true,
    });
    expect(normalizeBackgroundToolOption({ type: 'tool_category', category: 'game' })).toEqual({
      type: 'gameSet',
      any: true,
    });
    expect(normalizeBackgroundToolOption({ type: 'tool_category' })).toEqual({ type: 'tool', any: true });
    expect(normalizeBackgroundToolOption({ type: 'tool', id: 'tl-vehicules' })).toEqual({ type: 'tool', any: true });
    expect(normalizeBackgroundToolOption({ type: 'tool', id: 'tl-materiel-de-jeu' })).toEqual({ type: 'tool', any: true });
    expect(normalizeBackgroundToolOption({ type: 'tool', id: 'category-tools' })).toEqual({ type: 'tool', any: true });
    expect(normalizeBackgroundToolOption({ type: 'tool', id: 'tl-outils-dalchimiste' })).toEqual({
      type: 'tool',
      id: 'tl-necessaire-dalchimiste',
      any: false,
    });
    expect(normalizeBackgroundToolOption({ type: 'instrument', id: 'tl-luth' })).toEqual({
      type: 'instrument',
      id: 'tl-luth',
      any: false,
    });
    expect(normalizeBackgroundToolOption({ id: 'tl-outils-dalchimiste' })).toEqual({
      type: 'tool',
      id: 'tl-necessaire-dalchimiste',
      any: false,
    });
    expect(normalizeBackgroundToolOption({ id: 'tl-vehicules' })).toEqual({ type: 'vehicle', any: true });
    expect(normalizeBackgroundToolOption({ id: 'tl-materiel-de-jeu' })).toEqual({ type: 'gameSet', any: true });
    expect(normalizeBackgroundToolOption({ id: 'tl-luth' })).toEqual({ type: 'tool', id: 'tl-luth', any: false });
    expect(normalizeBackgroundToolOption({ foo: 1 })).toEqual({ type: 'tool', any: true });
    expect(normalizeBackgroundToolOption(null)).toEqual({ type: 'tool', any: true });
  });

  it('libellés de groupe', () => {
    expect(backgroundToolCategoryGroupLabel('instrument')).toBe('Instruments de musique');
    expect(backgroundToolCategoryGroupLabel('inconnu')).toBeNull();
  });

  it('bascule un id dans une liste plafonnée', () => {
    expect(toggleSkillIdInList(['a'], 'a', 2)).toEqual([]);
    expect(toggleSkillIdInList(['a'], 'b', 2)).toEqual(['a', 'b']);
    expect(toggleSkillIdInList(['a'], 'b', 1)).toEqual(['a']);
    expect(toggleSkillIdInList(['a'], 'b', 2, new Set(['b']))).toEqual(['a']);
    expect(toggleSkillIdInList(['a'], 'b', 2, new Set(), ['b'])).toEqual(['a']);
  });
});
