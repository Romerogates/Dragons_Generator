import { kenneySideForKind, kenneySpriteFile, kenneySpriteUrl } from './play-kenney-sprite.util';

describe('play-kenney-sprite.util', () => {
  it('picks a stable tile per id', () => {
    const a = kenneySpriteFile('hero-1', 'ally');
    const b = kenneySpriteFile('hero-1', 'ally');
    expect(a).toBe(b);
    expect(a.startsWith('tile_')).toBeTrue();
    expect(kenneySpriteUrl('hero-1', 'ally')).toContain(a);
  });

  it('maps monster kind to the enemy sheet', () => {
    expect(kenneySideForKind('monster')).toBe('enemy');
    expect(kenneySideForKind('enemy')).toBe('enemy');
    expect(kenneySideForKind('player')).toBe('ally');
    expect(kenneySideForKind('npc')).toBe('ally');
    expect(kenneySideForKind(undefined)).toBe('ally');
    expect(kenneySpriteFile('gob-1', 'enemy')).not.toBe(kenneySpriteFile('gob-1', 'ally'));
  });
});
