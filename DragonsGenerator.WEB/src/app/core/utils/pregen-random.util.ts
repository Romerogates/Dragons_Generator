const HERO_NAMES = [
  'Kael',
  'Lyra',
  'Thorin',
  'Mira',
  'Dorn',
  'Sera',
  'Viktor',
  'Naïla',
  'Ewan',
  'Zara',
  'Bryn',
  'Iska',
  'Orrin',
  'Ysolde',
];

export function pickRandom<T>(items: T[]): T | null {
  if (!items.length) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

export function randomHeroName(): string {
  return pickRandom(HERO_NAMES) ?? 'Aventurier';
}

