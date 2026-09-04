import { pickRandom, randomHeroName } from './pregen-random.util';

describe('pregen-random.util', () => {
  it('pickRandom returns null for an empty array', () => {
    expect(pickRandom([])).toBeNull();
  });

  it('pickRandom returns an item from the array', () => {
    const items = ['a', 'b', 'c'];
    const picked = pickRandom(items);
    expect(items).toContain(picked as string);
  });

  it('pickRandom returns the only item for a single-element array', () => {
    expect(pickRandom(['solo'])).toBe('solo');
  });

  it('randomHeroName returns a non-empty string', () => {
    const name = randomHeroName();
    expect(typeof name).toBe('string');
    expect(name.length).toBeGreaterThan(0);
  });
});
