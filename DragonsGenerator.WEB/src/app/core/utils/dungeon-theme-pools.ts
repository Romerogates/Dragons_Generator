import type { DungeonRandomEncounter, DungeonTheme } from '@core/models/Campaign/dungeon-map';

type PoolEntry = { name: string; cr: string; weight: number };

const POOLS: Record<DungeonTheme, PoolEntry[]> = {
  crypt: [
    { name: 'Squelette', cr: '1/4', weight: 4 },
    { name: 'Zombie', cr: '1/4', weight: 3 },
    { name: 'Spectre', cr: '1', weight: 2 },
    { name: 'Ghoule', cr: '1', weight: 2 },
    { name: 'Wight', cr: '3', weight: 1 },
    { name: 'Liche (serviteur)', cr: '5', weight: 1 },
  ],
  cave: [
    { name: 'Chauve-souris géante', cr: '1/4', weight: 4 },
    { name: 'Rat géant', cr: '1/8', weight: 3 },
    { name: 'Kobold', cr: '1/8', weight: 3 },
    { name: 'Gobelin', cr: '1/4', weight: 3 },
    { name: 'Troll des cavernes', cr: '5', weight: 1 },
    { name: 'Otyugh', cr: '5', weight: 1 },
  ],
  ruins: [
    { name: 'Bandit', cr: '1/8', weight: 3 },
    { name: 'Acolyte', cr: '1/4', weight: 2 },
    { name: 'Guenaud', cr: '1/2', weight: 3 },
    { name: 'Mimique', cr: '2', weight: 2 },
    { name: 'Gargouille', cr: '2', weight: 2 },
    { name: 'Chevalier spectrale', cr: '7', weight: 1 },
  ],
  temple: [
    { name: 'Acolyte', cr: '1/4', weight: 4 },
    { name: 'Cultiste', cr: '1/8', weight: 3 },
    { name: 'Prêtre', cr: '2', weight: 2 },
    { name: 'Gargouille', cr: '2', weight: 2 },
    { name: 'Élémentaire de l’air', cr: '5', weight: 1 },
    { name: 'Avatar maudit', cr: '8', weight: 1 },
  ],
  sewer: [
    { name: 'Rat géant', cr: '1/8', weight: 4 },
    { name: 'Slime gris', cr: '1/4', weight: 3 },
    { name: 'Gobelin', cr: '1/4', weight: 3 },
    { name: 'Gelée noire', cr: '2', weight: 2 },
    { name: 'Otyugh', cr: '5', weight: 2 },
    { name: 'Troll', cr: '5', weight: 1 },
  ],
  forest: [
    { name: 'Stirge', cr: '1/8', weight: 3 },
    { name: 'Loups', cr: '1/4', weight: 3 },
    { name: 'Dryade corrompue', cr: '1', weight: 2 },
    { name: 'Myconide', cr: '1/2', weight: 3 },
    { name: 'Shambling mound', cr: '5', weight: 1 },
    { name: 'Annis', cr: '6', weight: 1 },
  ],
  generic: [
    { name: 'Gobelin', cr: '1/4', weight: 4 },
    { name: 'Bandit', cr: '1/8', weight: 3 },
    { name: 'Orc', cr: '1/2', weight: 3 },
    { name: 'Ogre', cr: '2', weight: 2 },
    { name: 'Troll', cr: '5', weight: 1 },
    { name: 'Champion', cr: '9', weight: 1 },
  ],
};

const REGION_KEYWORDS: { keywords: string[]; theme: DungeonTheme }[] = [
  { keywords: ['crypte', 'tombe', 'nécro', 'mort', 'ossuaire'], theme: 'crypt' },
  { keywords: ['grotte', 'caverne', 'mont', 'souterrain', 'mine'], theme: 'cave' },
  { keywords: ['ruine', 'ancien', 'vestige', 'cité perdue'], theme: 'ruins' },
  { keywords: ['temple', 'sanctuaire', 'autel', 'culte', 'prière'], theme: 'temple' },
  { keywords: ['égout', 'fange', 'canalisation'], theme: 'sewer' },
  { keywords: ['forêt', 'bois', 'racine', 'mousse'], theme: 'forest' },
];

export function suggestThemeFromRegion(regionName: string | null | undefined): DungeonTheme {
  const lower = (regionName ?? '').toLowerCase();
  if (!lower.trim()) return 'generic';
  for (const entry of REGION_KEYWORDS) {
    if (entry.keywords.some((k) => lower.includes(k))) return entry.theme;
  }
  return 'ruins';
}

function pickWeighted(pool: PoolEntry[]): PoolEntry {
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let roll = Math.random() * total;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return pool[pool.length - 1];
}

export function rollRandomEncounter(theme: DungeonTheme, isBossRoom = false): DungeonRandomEncounter {
  const pool = POOLS[theme] ?? POOLS.generic;
  const count = isBossRoom ? 1 : 1 + Math.floor(Math.random() * 2);
  const creatures: DungeonRandomEncounter['creatures'] = [];
  for (let i = 0; i < count; i++) {
    const pick = pickWeighted(isBossRoom ? pool.slice(-2) : pool);
    const qty = isBossRoom ? 1 : 1 + Math.floor(Math.random() * 3);
    const existing = creatures.find((c) => c.name === pick.name);
    if (existing) {
      existing.quantity += qty;
    } else {
      creatures.push({ name: pick.name, quantity: qty, cr: pick.cr });
    }
  }
  return { creatures };
}
