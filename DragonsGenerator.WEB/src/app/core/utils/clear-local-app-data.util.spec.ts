import { clearLocalAppData } from './clear-local-app-data.util';

describe('clear-local-app-data.util', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('removes dragons and dragon_ prefixed keys from localStorage and sessionStorage', () => {
    localStorage.setItem('dragons-characters', '[]');
    localStorage.setItem('dragon_character_builder_v6', '{}');
    localStorage.setItem('other-app', 'keep');
    sessionStorage.setItem('dragons-current-character', '{}');
    sessionStorage.setItem('dragons_auth_user', '{}');
    clearLocalAppData();
    expect(localStorage.getItem('dragons-characters')).toBeNull();
    expect(localStorage.getItem('dragon_character_builder_v6')).toBeNull();
    expect(localStorage.getItem('other-app')).toBe('keep');
    expect(sessionStorage.getItem('dragons-current-character')).toBeNull();
    expect(sessionStorage.getItem('dragons_auth_user')).toBeNull();
  });

  it('ignores unrelated keys and handles empty storage', () => {
    localStorage.setItem('other', '1');
    clearLocalAppData();
    expect(localStorage.getItem('other')).toBe('1');
    clearLocalAppData();
  });

  it('skips null keys returned by storage.key', () => {
    localStorage.setItem('dragons-keep-scan', '1');
    const orig = localStorage.key.bind(localStorage);
    spyOn(localStorage, 'key').and.callFake((index: number) => (index === 0 ? null : orig(index)));
    clearLocalAppData();
    expect(localStorage.getItem('dragons-keep-scan')).toBe('1');
  });
});
