import {
  expandToolPoolIds,
  filterToolGroupsByPool,
  groupToolCatalog,
} from './skills-tool-catalog.util';
import type { ToolCatalogEntry } from './skills-tool-catalog.util';

const catalog: ToolCatalogEntry[] = [
  { id: 'tl-luth', name: 'Luth', type: 'TOOL', subtype: 'instrument' },
  { id: 'tl-marteau', name: 'Marteau', type: 'TOOL', subtype: 'artisan_tool' },
  { id: 'tl-des', name: 'Dés', type: 'TOOL', subtype: 'gaming_set' },
  { id: 'vhc-charrette', name: 'Charrette', type: 'VEHICLE', subtype: 'land' },
  { id: 'tl-outils-de-voleur', name: 'Outils de voleur', type: 'TOOL', subtype: 'thieves_tools' },
];

describe('skills-tool-catalog.util', () => {
  it('groupe le catalogue par famille', () => {
    const groups = groupToolCatalog(catalog);
    expect(groups.map((g) => g.label)).toEqual([
      "Outils d'artisan",
      'Kits et outils spéciaux',
      'Instruments de musique',
      'Matériel de jeu',
      'Véhicules',
    ]);
  });

  it('étend un jeton véhicule terrestre', () => {
    const ids = expandToolPoolIds(['tl-vehicules-terrestres'], catalog, groupToolCatalog(catalog));
    expect([...ids]).toEqual(['vhc-charrette']);
  });

  it('étend une catégorie instruments', () => {
    const groups = groupToolCatalog(catalog);
    const ids = expandToolPoolIds(['tl-instrument-de-musique'], catalog, groups);
    expect([...ids]).toEqual(['tl-luth']);
  });

  it('filtre les groupes selon le pool, sinon catalogue complet', () => {
    const groups = groupToolCatalog(catalog);
    const filtered = filterToolGroupsByPool(groups, new Set(['tl-luth']));
    expect(filtered).toEqual([
      { label: 'Instruments de musique', icon: 'fluent-emoji:violin', items: [catalog[0]] },
    ]);
    expect(filterToolGroupsByPool(groups, new Set())).toBe(groups);
  });

  it('classe les outils sans subtype et étend air / id brut', () => {
    const loose: ToolCatalogEntry[] = [
      { id: 'tl-flute', name: 'Flûte', type: 'TOOL', subtype: null },
      { id: 'tl-inconnu', name: 'Inconnu', type: 'TOOL', subtype: null },
      { id: 'vhc-zep', name: 'Zep', type: 'VEHICLE', subtype: 'air' },
      { id: 'skip', name: 'X', type: 'OTHER', subtype: null },
    ];
    const groups = groupToolCatalog(loose);
    expect(groups.some((g) => g.label === 'Instruments de musique')).toBeTrue();
    expect(groups.some((g) => g.label === "Outils d'artisan")).toBeTrue();
    const air = expandToolPoolIds(['tl-vehicules-aeriens'], loose, groups);
    expect([...air]).toContain('vhc-zep');
    const raw = expandToolPoolIds(['tl-inconnu'], loose, groups);
    expect([...raw]).toContain('tl-inconnu');
    expect(filterToolGroupsByPool(groups, new Set(['absent']))).toEqual(groups);
    const kits = groupToolCatalog([
      { id: 'tl-outils-de-voleur', name: 'Voleur', type: 'TOOL', subtype: null },
      { id: 'tl-des', name: 'Dés', type: 'TOOL', subtype: null },
    ]);
    expect(kits.map((g) => g.label)).toEqual(['Kits et outils spéciaux', 'Matériel de jeu']);
    const water = expandToolPoolIds(
      ['tl-vehicules-maritimes', 'tl-outils-artisan', 'tl-materiel-de-jeu'],
      [
        { id: 'vhc-barque', name: 'Barque', type: 'VEHICLE', subtype: 'water' },
        { id: 'tl-marteau', name: 'Marteau', type: 'TOOL', subtype: 'artisan_tool' },
        { id: 'tl-des', name: 'Dés', type: 'TOOL', subtype: 'gaming_set' },
      ],
      groupToolCatalog([
        { id: 'vhc-barque', name: 'Barque', type: 'VEHICLE', subtype: 'water' },
        { id: 'tl-marteau', name: 'Marteau', type: 'TOOL', subtype: 'artisan_tool' },
        { id: 'tl-des', name: 'Dés', type: 'TOOL', subtype: 'gaming_set' },
      ]),
    );
    expect(water.has('vhc-barque')).toBeTrue();
    expect(water.has('tl-marteau')).toBeTrue();
    expect(water.has('tl-des')).toBeTrue();
  });
});
