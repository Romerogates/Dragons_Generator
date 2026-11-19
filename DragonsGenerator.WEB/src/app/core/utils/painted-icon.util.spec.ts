import { resolvePaintedIcon } from './painted-icon.util';

describe('resolvePaintedIcon', () => {
  it('keeps asset paths', () => {
    expect(resolvePaintedIcon('/assets/equipment/dagger.png')).toBe('/assets/equipment/dagger.png');
  });

  it('maps Codex smileys to painted portraits', () => {
    expect(resolvePaintedIcon('fluent-emoji:dragon')).toBe('/assets/equipment/ui-dragon.png');
    expect(resolvePaintedIcon('fluent-emoji:sparkles')).toBe('/assets/equipment/ui-sparkles.png');
    expect(resolvePaintedIcon('fluent-emoji:crossed-swords')).toBe(
      '/assets/equipment/cat-weapon.png',
    );
  });

  it('never returns a fluent-emoji id', () => {
    expect(resolvePaintedIcon('fluent-emoji:red-question-mark').startsWith('/assets/')).toBeTrue();
  });
});
