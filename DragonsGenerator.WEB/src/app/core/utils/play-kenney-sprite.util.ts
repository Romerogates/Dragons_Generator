/** Sprites Kenney Tiny Dungeon (CC0) — petits bonhommes 16×16. */

export const KENNEY_SPRITE_BASE = '/sprites/kenney-tiny-dungeon';

const ALLY_TILES = [
  'tile_0084.png',
  'tile_0085.png',
  'tile_0086.png',
  'tile_0087.png',
  'tile_0088.png',
  'tile_0089.png',
] as const;

const ENEMY_TILES = [
  'tile_0096.png',
  'tile_0097.png',
  'tile_0098.png',
  'tile_0099.png',
  'tile_0108.png',
  'tile_0109.png',
  'tile_0110.png',
] as const;

export type KenneyPawnSide = 'ally' | 'enemy';
export type KenneyPawnPose = 'idle' | 'attack' | 'wait';

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function kenneySpriteFile(id: string, side: KenneyPawnSide): string {
  const pack = side === 'ally' ? ALLY_TILES : ENEMY_TILES;
  return pack[hashId(id) % pack.length]!;
}

export function kenneySpriteUrl(id: string, side: KenneyPawnSide): string {
  return `${KENNEY_SPRITE_BASE}/${kenneySpriteFile(id, side)}`;
}

export function kenneySideForKind(kind: string | null | undefined): KenneyPawnSide {
  return kind === 'monster' || kind === 'enemy' ? 'enemy' : 'ally';
}
