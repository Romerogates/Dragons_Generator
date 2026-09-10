import type {
  SessionPlayPad,
  SessionPlayPadLayout,
  SessionPlayPadWidgetSize,
} from '@core/models/Campaign/campaign';

export const PAD_GRID_COLS = 12;
export const PAD_GRID_ROW_PX = 52;
export const PAD_MIN_W = 3;
export const PAD_MIN_H = 3;
export const PAD_DEFAULT_W = 6;
export const PAD_DEFAULT_H = 6;

export function widthFromWidgetSize(size?: SessionPlayPadWidgetSize | null): number {
  if (size === 'full') return PAD_GRID_COLS;
  if (size === 'third') return 4;
  return PAD_DEFAULT_W;
}

export function clampLayout(layout: SessionPlayPadLayout): SessionPlayPadLayout {
  const w = Math.min(PAD_GRID_COLS, Math.max(PAD_MIN_W, Math.round(layout.w)));
  const h = Math.max(PAD_MIN_H, Math.round(layout.h));
  const x = Math.min(PAD_GRID_COLS - w, Math.max(0, Math.round(layout.x)));
  const y = Math.max(0, Math.round(layout.y));
  return { x, y, w, h };
}

export function layoutsOverlap(a: SessionPlayPadLayout, b: SessionPlayPadLayout): boolean {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}

export function boardRowCount(pads: { layout?: SessionPlayPadLayout }[]): number {
  let max = 8;
  for (const p of pads) {
    const l = p.layout;
    if (!l) continue;
    max = Math.max(max, l.y + l.h + 2);
  }
  return max;
}

/** Place une boîte w×h sans chevauchement (scan lignes). */
export function findFreeLayout(
  w: number,
  h: number,
  occupied: SessionPlayPadLayout[],
  preferY = 0,
): SessionPlayPadLayout {
  const width = Math.min(PAD_GRID_COLS, Math.max(PAD_MIN_W, w));
  const height = Math.max(PAD_MIN_H, h);
  for (let y = preferY; y < preferY + 80; y++) {
    for (let x = 0; x <= PAD_GRID_COLS - width; x++) {
      const candidate = { x, y, w: width, h: height };
      if (!occupied.some((o) => layoutsOverlap(candidate, o))) return candidate;
    }
  }
  return { x: 0, y: preferY + 80, w: width, h: height };
}

export function layoutFromLegacy(
  size: SessionPlayPadWidgetSize | undefined,
  order: number,
): SessionPlayPadLayout {
  const w = widthFromWidgetSize(size);
  const perRow = Math.max(1, Math.floor(PAD_GRID_COLS / w));
  const col = order % perRow;
  const row = Math.floor(order / perRow);
  return clampLayout({ x: col * w, y: row * PAD_DEFAULT_H, w, h: PAD_DEFAULT_H });
}

export function resolvePadLayout(
  pad: SessionPlayPad,
  index: number,
  prior: SessionPlayPadLayout[],
): SessionPlayPadLayout {
  if (pad.layout && Number.isFinite(pad.layout.x) && Number.isFinite(pad.layout.w)) {
    return clampLayout(pad.layout);
  }
  const legacy = layoutFromLegacy(pad.widgetSize, typeof pad.order === 'number' ? pad.order : index);
  if (!prior.some((o) => layoutsOverlap(legacy, o))) return legacy;
  return findFreeLayout(legacy.w, legacy.h, prior, legacy.y);
}

export function ensurePadsHaveLayouts(pads: SessionPlayPad[]): SessionPlayPad[] {
  const placed: SessionPlayPadLayout[] = [];
  return pads.map((p, i) => {
    const layout = resolvePadLayout(p, i, placed);
    placed.push(layout);
    return { ...p, layout, order: typeof p.order === 'number' ? p.order : i };
  });
}

export function padGridStyle(layout: SessionPlayPadLayout): Record<string, string> {
  const l = clampLayout(layout);
  return {
    gridColumn: `${l.x + 1} / span ${l.w}`,
    gridRow: `${l.y + 1} / span ${l.h}`,
  };
}
