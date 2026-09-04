import {
  buildHandoutBody,
  drawDungeonToCanvas,
  dungeonMapToAscii,
  dungeonMapToPngDataUrl,
  exportDungeonPdf,
  exportDungeonPng,
  fogRevealSet,
  roomAt,
  roomLabelAt,
  themePalette,
  tileAt,
} from './dungeon-render.util';
import type { EncounterGroup } from '@core/models/Campaign/campaign';
import type { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';

function sampleMap(overrides: Partial<CampaignDungeonMap> = {}): CampaignDungeonMap {
  return {
    id: 'm1',
    name: 'Crypte test',
    theme: 'crypt',
    regionName: 'Eana',
    gridWidth: 4,
    gridHeight: 3,
    tiles: [
      ['wall', 'floor', 'floor', 'wall'],
      ['wall', 'floor', 'door', 'wall'],
      ['wall', 'wall', 'wall', 'wall'],
    ],
    rooms: [
      {
        id: 'r1',
        label: 'Salle 1',
        x: 1,
        y: 0,
        width: 2,
        height: 2,
        notes: 'Note salle',
        randomEncounter: {
          creatures: [{ name: 'Squelette', quantity: 2, cr: '1/4' }],
        },
      },
    ],
    markers: [
      { id: 'mk1', kind: 'chest', x: 1, y: 1, label: 'Coffre', notes: 'or' },
      { id: 'mk2', kind: 'trap', x: 2, y: 0, notes: '' },
      { id: 'mk3', kind: 'door', x: 2, y: 1 },
      { id: 'mk4', kind: 'stairs', x: 1, y: 0 },
      { id: 'mk5', kind: 'note', x: 0, y: 0, label: 'Indice' },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('dungeon-render helpers', () => {
  it('reads tiles and rooms', () => {
    const map = sampleMap();
    expect(tileAt(map, 1, 0)).toBe('floor');
    expect(tileAt(map, 99, 99)).toBe('wall');
    expect(roomAt(map, 1, 0)).toBe('r1');
    expect(roomAt(map, 0, 0)).toBeNull();
    expect(roomLabelAt(map, 'r1')).toBe('Salle 1');
    expect(roomLabelAt(map, 'missing')).toBe('');
  });

  it('builds ascii overview', () => {
    const ascii = dungeonMapToAscii(sampleMap());
    expect(ascii.split('\n').length).toBe(3);
    expect(ascii).toContain('#');
    expect(ascii).toContain('$');
  });

  it('exposes distinct theme palettes', () => {
    expect(themePalette('crypt').floor).not.toBe(themePalette('temple').floor);
    expect(themePalette('unknown').bg).toBe(themePalette('generic').bg);
  });

  it('draws canvas and exports png data url', () => {
    const map = sampleMap();
    const canvas = document.createElement('canvas');
    drawDungeonToCanvas(map, canvas, 8, { showRoomNumbers: true, selectedRoomId: 'r1' });
    expect(canvas.width).toBe(32);
    expect(canvas.height).toBe(24);
    const url = dungeonMapToPngDataUrl(map, 6);
    expect(url.startsWith('data:image/png;base64,')).toBeTrue();
  });

  it('buildHandoutBody includes legend, markers and map image markdown', () => {
    const body = buildHandoutBody(sampleMap(), []);
    expect(body).toContain('# Crypte test');
    expect(body).toContain('## Légende des salles');
    expect(body).toContain('**Salle 1**');
    expect(body).not.toContain('Squelette');
    expect(body).not.toContain('Note salle');
    expect(body).toContain('## Points d’intérêt');
    expect(body).toContain('Coffre');
    expect(body).not.toContain(' — or');
    expect(body).not.toContain('Indice');
    expect(body).toMatch(/!\[Crypte test\]\(data:image\/png;base64,/);
  });

  it('draws canvas without room numbers', () => {
    const canvas = document.createElement('canvas');
    drawDungeonToCanvas(sampleMap(), canvas, 8, { showRoomNumbers: false });
    expect(canvas.width).toBeGreaterThan(0);
  });

  it('buildHandoutBody prefers custom creature names from campaign encounters', () => {
    const map = sampleMap({
      rooms: [
        {
          id: 'r1',
          label: 'Boss',
          x: 1,
          y: 0,
          width: 1,
          height: 1,
          encounterId: 'enc-1',
        },
        {
          id: 'r2',
          label: 'Manquant',
          x: 2,
          y: 0,
          width: 1,
          height: 1,
          encounterId: 'missing',
        },
      ],
    });
    const encounters: EncounterGroup[] = [
      {
        id: 'enc-1',
        name: 'Boss',
        creatures: [
          {
            creatureId: 'c1',
            creatureName: 'Liche',
            customName: 'Archiliche',
            quantity: 1,
            defeated: 0,
            challengeRating: '10',
            xp: 5900,
          },
        ],
      },
    ];
    const body = buildHandoutBody(map, encounters, { includeGmDetails: true, playerFog: false });
    expect(body).toContain('1× Archiliche');
    expect(body).toContain('**Manquant**');
  });

  it('buildHandoutBody shows dash when room has no encounter', () => {
    const map = sampleMap({
      rooms: [{ id: 'r1', label: 'Vide', x: 1, y: 0, width: 1, height: 1 }],
      markers: [],
      regionName: undefined,
    });
    const body = buildHandoutBody(map, [], { includeGmDetails: true, playerFog: false });
    expect(body).toContain('**Vide** : —');
  });

  it('exportDungeonPng triggers a download link', async () => {
    const anchor = document.createElement('a');
    spyOn(anchor, 'click');
    const original = Document.prototype.createElement;
    spyOn(document, 'createElement').and.callFake(function (this: Document, tagName: string, options?: string | ElementCreationOptions) {
      if (tagName.toLowerCase() === 'a') return anchor;
      return original.call(this, tagName, options as ElementCreationOptions);
    } as typeof document.createElement);

    await exportDungeonPng(sampleMap(), 'carte.png');
    expect(anchor.download).toBe('carte.png');
    expect(anchor.href.startsWith('data:image/png')).toBeTrue();
    expect(anchor.click).toHaveBeenCalled();
  });

  it('exportDungeonPdf covers encounter and empty room branches', async () => {
    const map = sampleMap({
      rooms: [
        {
          id: 'r1',
          label: 'Boss',
          x: 1,
          y: 0,
          width: 1,
          height: 1,
          encounterId: 'enc-1',
        },
        {
          id: 'r2',
          label: 'Manquant',
          x: 2,
          y: 0,
          width: 1,
          height: 1,
          encounterId: 'missing',
        },
        {
          id: 'r3',
          label: 'Vide',
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        },
      ],
    });
    const encounters: EncounterGroup[] = [
      {
        id: 'enc-1',
        name: 'Boss',
        creatures: [
          {
            creatureId: 'c1',
            creatureName: 'Liche',
            customName: 'Archiliche',
            quantity: 1,
            defeated: 0,
            challengeRating: '10',
            xp: 5900,
          },
        ],
      },
    ];
    await expectAsync(
      exportDungeonPdf(map, encounters, 'branches.pdf', { includeGmDetails: true, playerFog: false }),
    ).toBeResolved();
  });

  it('fogRevealSet returns null when fog disabled', () => {
    expect(fogRevealSet(sampleMap())).toBeNull();
    expect(fogRevealSet(sampleMap({ fogOfWarEnabled: true, revealedRoomIds: ['r1'] }))).toEqual(
      new Set(['r1']),
    );
  });

  it('buildHandoutBody with playerFog hides unrevealed rooms and markers', () => {
    const map = sampleMap({ fogOfWarEnabled: true, revealedRoomIds: [] });
    const body = buildHandoutBody(map, [], { playerFog: true });
    expect(body).not.toContain('**Salle 1**');
    expect(body).not.toContain('Coffre');
    expect(body).toMatch(/!\[Crypte test\]\(data:image\/png;base64,/);
  });

  it('buildHandoutBody GM details keep notes and random encounters', () => {
    const body = buildHandoutBody(sampleMap(), [], { includeGmDetails: true, playerFog: false });
    expect(body).toContain('2× Squelette (FP 1/4)');
    expect(body).toContain('Note salle');
    expect(body).toContain(' — or');
  });

  it('exportDungeonPng applies fog when enabled', async () => {
    const anchor = document.createElement('a');
    spyOn(anchor, 'click');
    const original = Document.prototype.createElement;
    spyOn(document, 'createElement').and.callFake(function (
      this: Document,
      tagName: string,
      options?: string | ElementCreationOptions,
    ) {
      if (tagName.toLowerCase() === 'a') return anchor;
      return original.call(this, tagName, options as ElementCreationOptions);
    } as typeof document.createElement);

    await exportDungeonPng(
      sampleMap({ fogOfWarEnabled: true, revealedRoomIds: ['r1'] }),
      'fog.png',
    );
    expect(anchor.download).toBe('fog.png');
    expect(anchor.click).toHaveBeenCalled();
  });

  it('drawDungeonToCanvas applies fog overlay for unrevealed rooms', () => {
    const map = sampleMap({ fogOfWarEnabled: true, revealedRoomIds: [] });
    const canvas = document.createElement('canvas');
    drawDungeonToCanvas(map, canvas, 8, { revealedRoomIds: fogRevealSet(map) });
    expect(canvas.width).toBe(32);
  });

  /** Petite carte dédiée : 2 salles reliées par un couloir de 3 cases (x=1,2,3). */
  function corridorMap(): CampaignDungeonMap {
    return sampleMap({
      gridWidth: 5,
      gridHeight: 1,
      tiles: [['floor', 'floor', 'floor', 'floor', 'floor']],
      rooms: [
        { id: 'ra', label: 'Salle A', x: 0, y: 0, width: 1, height: 1 },
        { id: 'rb', label: 'Salle B', x: 4, y: 0, width: 1, height: 1 },
      ],
      markers: [],
    });
  }

  const FOG_RGB = '6,8,12'; // '#06080c'

  function cellRgb(canvas: HTMLCanvasElement, cellSize: number, x: number, y: number): string {
    const ctx = canvas.getContext('2d')!;
    const [r, g, b] = ctx.getImageData(x * cellSize + 1, y * cellSize + 1, 1, 1).data;
    return `${r},${g},${b}`;
  }

  it('lève tout le brouillard du couloir quand SES DEUX salles sont révélées', () => {
    const map = corridorMap();
    const canvas = document.createElement('canvas');
    const cellSize = 10;
    drawDungeonToCanvas(map, canvas, cellSize, {
      revealedRoomIds: new Set(['ra', 'rb']),
      showGrid: false,
      vignette: false,
    });
    // Cellule médiane du couloir (x=2), loin des halos d'1 case de chaque salle.
    expect(cellRgb(canvas, cellSize, 2, 0)).not.toBe(FOG_RGB);
  });

  it("ne révèle qu'un halo d'1 case quand une seule extrémité du couloir est révélée", () => {
    const map = corridorMap();
    const canvas = document.createElement('canvas');
    const cellSize = 10;
    drawDungeonToCanvas(map, canvas, cellSize, {
      revealedRoomIds: new Set(['ra']),
      showGrid: false,
      vignette: false,
    });
    // Adjacente à la salle révélée : visible (halo).
    expect(cellRgb(canvas, cellSize, 1, 0)).not.toBe(FOG_RGB);
    // Plus loin dans le couloir, toujours dans le brouillard tant que rb n'est pas révélée.
    expect(cellRgb(canvas, cellSize, 3, 0)).toBe(FOG_RGB);
  });
});
