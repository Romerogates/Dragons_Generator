import { generateDungeonMap } from './dungeon-generator.util';

describe('dungeon-generator.util', () => {
  it('génère une grille de la taille demandée avec salles et portes', () => {
    const map = generateDungeonMap(
      {
        gridWidth: 32,
        gridHeight: 32,
        roomCount: 6,
        corridorDensity: 50,
        theme: 'crypt',
        seed: 42,
      },
      { name: 'Test crypte', regionName: 'Ossuaire' },
    );

    expect(map.name).toBe('Test crypte');
    expect(map.theme).toBe('crypt');
    expect(map.gridWidth).toBe(32);
    expect(map.gridHeight).toBe(32);
    expect(map.tiles.length).toBe(32);
    expect(map.tiles[0].length).toBe(32);
    expect(map.rooms.length).toBeGreaterThanOrEqual(3);
    expect(map.rooms.length).toBeLessThanOrEqual(6);
    expect(map.rooms.every((r) => r.width >= 4 && r.height >= 4)).toBeTrue();
    expect(map.markers.some((m) => m.kind === 'door')).toBeTrue();
    expect(map.rooms.some((r) => (r.randomEncounter?.creatures.length ?? 0) > 0)).toBeTrue();
  });

  it('est déterministe avec le même seed', () => {
    const params = {
      gridWidth: 24,
      gridHeight: 24,
      roomCount: 5,
      corridorDensity: 40,
      theme: 'cave' as const,
      seed: 7,
    };
    const a = generateDungeonMap(params, { name: 'A' });
    const b = generateDungeonMap(params, { name: 'B' });
    expect(a.tiles).toEqual(b.tiles);
    expect(a.rooms.map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height }))).toEqual(
      b.rooms.map((r) => ({ x: r.x, y: r.y, w: r.width, h: r.height })),
    );
  });

  it('produit des layouts différents avec des seeds différents', () => {
    const base = {
      gridWidth: 28,
      gridHeight: 28,
      roomCount: 5,
      corridorDensity: 50,
      theme: 'ruins' as const,
    };
    const a = generateDungeonMap({ ...base, seed: 1 }, { name: 'A' });
    const b = generateDungeonMap({ ...base, seed: 99 }, { name: 'B' });
    expect(JSON.stringify(a.tiles)).not.toEqual(JSON.stringify(b.tiles));
  });

  it('place du sol à l’intérieur des salles', () => {
    const map = generateDungeonMap(
      {
        gridWidth: 32,
        gridHeight: 32,
        roomCount: 4,
        corridorDensity: 60,
        theme: 'generic',
        seed: 3,
      },
      { name: 'Sol' },
    );
    const room = map.rooms[0];
    expect(map.tiles[room.y][room.x]).toBe('floor');
  });
});
