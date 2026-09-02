import {
  dismissAuthCookieMigrationBanner,
  hasLegacyAuthArtifacts,
  hasLegacyAuthToken,
  isAuthCookieMigrationDismissed,
  shouldShowReconnectBanner,
} from './legacy-auth-migration.util';

describe('legacy-auth-migration.util', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('detects legacy JWT in localStorage', () => {
    localStorage.setItem('dragons_auth_token', 'old-jwt');
    expect(hasLegacyAuthToken()).toBeTrue();
    expect(hasLegacyAuthArtifacts()).toBeTrue();
    expect(shouldShowReconnectBanner()).toBeTrue();
  });

  it('detects legacy user profile in localStorage', () => {
    localStorage.setItem('dragons_auth_user', '{}');
    expect(shouldShowReconnectBanner()).toBeTrue();
  });

  it('returns false when no legacy artifacts', () => {
    expect(hasLegacyAuthArtifacts()).toBeFalse();
    expect(shouldShowReconnectBanner()).toBeFalse();
  });

  it('respects dismiss flag', () => {
    localStorage.setItem('dragons_auth_token', 'old-jwt');
    sessionStorage.setItem('dragons-auth-cookie-migration-dismissed', '1');
    expect(isAuthCookieMigrationDismissed()).toBeTrue();
    expect(shouldShowReconnectBanner()).toBeFalse();
  });

  it('dismiss clears legacy keys and hides banner', () => {
    localStorage.setItem('dragons_auth_token', 'old-jwt');
    localStorage.setItem('dragons-characters', '[]');
    dismissAuthCookieMigrationBanner();
    expect(localStorage.getItem('dragons_auth_token')).toBeNull();
    expect(localStorage.getItem('dragons-characters')).toBeNull();
    expect(shouldShowReconnectBanner()).toBeFalse();
  });
});
