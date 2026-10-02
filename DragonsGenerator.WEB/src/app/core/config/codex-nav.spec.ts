import { CODEX_NAV_LINKS, filterCodexNavLinks } from './codex-nav';

describe('codex-nav', () => {
  it('lists 11 catalogs', () => {
    expect(CODEX_NAV_LINKS.length).toBe(11);
    expect(CODEX_NAV_LINKS.some((l) => l.path === '/backgrounds')).toBeTrue();
    expect(CODEX_NAV_LINKS.some((l) => l.path === '/civilisations')).toBeTrue();
  });

  it('paths are unique', () => {
    const paths = CODEX_NAV_LINKS.map((l) => l.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('matches French synonyms', () => {
    expect(filterCodexNavLinks('monstre').some((l) => l.path === '/creatures')).toBeTrue();
    expect(filterCodexNavLinks('magie').some((l) => l.path === '/spells')).toBeTrue();
    expect(filterCodexNavLinks('peuples').some((l) => l.path === '/species')).toBeTrue();
    expect(filterCodexNavLinks('grimoire').some((l) => l.path === '/spells')).toBeTrue();
    expect(filterCodexNavLinks('zzz-unknown').length).toBe(0);
    expect(filterCodexNavLinks('').length).toBe(11);
    expect(filterCodexNavLinks('   ').length).toBe(11);
  });

  it('matches label, path, blurb and reverse synonym includes', () => {
    expect(filterCodexNavLinks('Espèces').some((l) => l.path === '/species')).toBeTrue();
    expect(filterCodexNavLinks('/deities').some((l) => l.path === '/deities')).toBeTrue();
    expect(filterCodexNavLinks('Panthéon').some((l) => l.path === '/deities')).toBeTrue();
    expect(filterCodexNavLinks('Neuf peuples').some((l) => l.path === '/species')).toBeTrue();
    // query includes synonym (not only synonym includes query)
    expect(filterCodexNavLinks('les monstres du bestiaire').some((l) => l.path === '/creatures')).toBeTrue();
  });
});
