import { ForgePreferencesService } from './forge-preferences.service';

describe('ForgePreferencesService', () => {
  const KEY = 'dragons-forge-skip-mode-prompt';

  beforeEach(() => {
    localStorage.removeItem(KEY);
  });

  afterEach(() => {
    localStorage.removeItem(KEY);
  });

  it('defaults skipModePrompt to false', () => {
    const svc = new ForgePreferencesService();
    expect(svc.skipModePrompt()).toBeFalse();
  });

  it('persists skipModePrompt in localStorage', () => {
    const svc = new ForgePreferencesService();
    svc.setSkipModePrompt(true);
    expect(svc.skipModePrompt()).toBeTrue();
    expect(localStorage.getItem(KEY)).toBe('1');

    const again = new ForgePreferencesService();
    expect(again.skipModePrompt()).toBeTrue();
  });
});
