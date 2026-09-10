import {
  clampLayout,
  findFreeLayout,
  layoutFromLegacy,
  layoutsOverlap,
  widthFromWidgetSize,
  ensurePadsHaveLayouts,
} from './pad-layout.util';
import type { SessionPlayPad } from '@core/models/Campaign/campaign';

describe('pad-layout.util', () => {
  it('maps legacy widget sizes to widths', () => {
    expect(widthFromWidgetSize('full')).toBe(12);
    expect(widthFromWidgetSize('third')).toBe(4);
    expect(widthFromWidgetSize('half')).toBe(6);
  });

  it('clamps layout into the grid', () => {
    expect(clampLayout({ x: -2, y: -1, w: 20, h: 1 })).toEqual({ x: 0, y: 0, w: 12, h: 3 });
  });

  it('detects overlaps', () => {
    expect(layoutsOverlap({ x: 0, y: 0, w: 6, h: 4 }, { x: 5, y: 2, w: 4, h: 4 })).toBe(true);
    expect(layoutsOverlap({ x: 0, y: 0, w: 6, h: 4 }, { x: 6, y: 0, w: 6, h: 4 })).toBe(false);
  });

  it('finds a free slot', () => {
    const free = findFreeLayout(6, 4, [{ x: 0, y: 0, w: 6, h: 4 }]);
    expect(free.x).toBe(6);
    expect(free.y).toBe(0);
  });

  it('migrates legacy pads to layouts', () => {
    const pads: SessionPlayPad[] = [
      {
        id: 'a',
        kind: 'note',
        title: 'A',
        order: 0,
        widgetSize: 'full',
      },
      {
        id: 'b',
        kind: 'checklist',
        title: 'B',
        order: 1,
        widgetSize: 'half',
        items: [],
      },
    ];
    const next = ensurePadsHaveLayouts(pads);
    expect(next[0]!.layout?.w).toBe(12);
    expect(next[1]!.layout?.w).toBe(6);
    expect(layoutsOverlap(next[0]!.layout!, next[1]!.layout!)).toBe(false);
  });

  it('builds legacy layout from order', () => {
    const a = layoutFromLegacy('half', 0);
    const b = layoutFromLegacy('half', 1);
    expect(a.x).toBe(0);
    expect(b.x).toBe(6);
  });
});
