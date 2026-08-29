import { clearLocalAppData } from './clear-local-app-data.util';

describe('clear-local-app-data.util', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('removes dragons and dragon_ prefixed keys', () => {
    localStorage.setItem('dragons-characters', '[]');
    localStorage.setItem('dragon_character_builder_v6', '{}');
    localStorage.setItem('other-app', 'keep');
    clearLocalAppData();
    expect(localStorage.getItem('dragons-characters')).toBeNull();
    expect(localStorage.getItem('dragon_character_builder_v6')).toBeNull();
    expect(localStorage.getItem('other-app')).toBe('keep');
  });
});
