import { carouselIndexFromScroll, carouselScrollDeltaToIndex, toggleFlipId } from './forge-carousel.util';

describe('forge-carousel.util', () => {
  it('bascule un id de verso', () => {
    const a = toggleFlipId(new Set(), 'c1');
    expect(a.has('c1')).toBeTrue();
    expect(toggleFlipId(a, 'c1').has('c1')).toBeFalse();
  });

  it('index / delta sans cartes dans le viewport', () => {
    const viewport = document.createElement('div');
    Object.defineProperty(viewport, 'clientWidth', { value: 300 });
    expect(carouselIndexFromScroll(viewport)).toBe(0);
    expect(carouselScrollDeltaToIndex(viewport, 0)).toBeNull();
  });
});
