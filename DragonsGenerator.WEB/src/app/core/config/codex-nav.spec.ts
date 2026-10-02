import { CODEX_NAV_LINKS, filterCodexNavLinks } from './codex-nav';

describe('codex-nav', () => {
  it('lists 11 catalogs', () => {
    expect(CODEX_NAV_LINKS.length).toBe(11);
    expect(CODEX_NAV_LINKS.some((l) => l.path === '/backgrounds')).toBeTrue();
    expect(CODEX_NAV_LINKS.some((l) => l.path === '/civilisations')).toBeTrue();
  });

  it('matches French synonyms', () => {
    expect(filterCodexNavLinks('monstre').some((l) => l.path === '/creatures')).toBeTrue();
    expect(filterCodexNavLinks('magie').some((l) => l.path === '/spells')).toBeTrue();
    expect(filterCodexNavLinks('peuples').some((l) => l.path === '/species')).toBeTrue();
    expect(filterCodexNavLinks('grimoire').some((l) => l.path === '/spells')).toBeTrue();
    expect(filterCodexNavLinks('zzz-unknown').length).toBe(0);
    expect(filterCodexNavLinks('').length).toBe(11);
  });
});
