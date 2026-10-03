import { ForgePreferencesService } from './forge-preferences.service';

describe('ForgePreferencesService', () => {
  const SKIP_KEY = 'dragons-forge-skip-mode-prompt';
  const RECAP_KEY = 'dragons-forge-mobile-recap-mode';

  beforeEach(() => {
    localStorage.removeItem(SKIP_KEY);
    localStorage.removeItem(RECAP_KEY);
  });

  afterEach(() => {
    localStorage.removeItem(SKIP_KEY);
    localStorage.removeItem(RECAP_KEY);
  });

  it('defaults skipModePrompt to false', () => {
    const svc = new ForgePreferencesService();
    expect(svc.skipModePrompt()).toBeFalse();
  });

  it('persists skipModePrompt in localStorage', () => {
    const svc = new ForgePreferencesService();
    svc.setSkipModePrompt(true);
    expect(svc.skipModePrompt()).toBeTrue();
    expect(localStorage.getItem(SKIP_KEY)).toBe('1');

    const again = new ForgePreferencesService();
    expect(again.skipModePrompt()).toBeTrue();
  });

  it('defaults mobileRecapMode to pdf', () => {
    const svc = new ForgePreferencesService();
    expect(svc.mobileRecapMode()).toBe('pdf');
  });

  it('persists mobileRecapMode in localStorage', () => {
    const svc = new ForgePreferencesService();
    svc.setMobileRecapMode('compact');
    expect(svc.mobileRecapMode()).toBe('compact');
    expect(localStorage.getItem(RECAP_KEY)).toBe('compact');

    const again = new ForgePreferencesService();
    expect(again.mobileRecapMode()).toBe('compact');
  });
});
