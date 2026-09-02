const LEGACY_AUTH_TOKEN_KEY = 'dragons_auth_token';
const LEGACY_AUTH_USER_LOCAL_KEY = 'dragons_auth_user';
export const AUTH_COOKIE_MIGRATION_DISMISS_KEY = 'dragons-auth-cookie-migration-dismissed';

const LEGACY_AUTH_LOCAL_KEYS = [
  LEGACY_AUTH_TOKEN_KEY,
  LEGACY_AUTH_USER_LOCAL_KEY,
  'dragons-characters',
  'dragons-campaigns-local',
  'dragons-current-character',
  'dragons-edit-character',
] as const;

/** Ancien JWT Phase 1 encore présent en localStorage. */
export function hasLegacyAuthToken(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return !!localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
}

/** Profil auth Phase 1 stocké en localStorage (Phase 2 = sessionStorage). */
export function hasLegacyAuthUserInLocalStorage(): boolean {
  if (typeof localStorage === 'undefined') return false;
  return !!localStorage.getItem(LEGACY_AUTH_USER_LOCAL_KEY);
}

export function hasLegacyAuthArtifacts(): boolean {
  return hasLegacyAuthToken() || hasLegacyAuthUserInLocalStorage();
}

export function isAuthCookieMigrationDismissed(): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(AUTH_COOKIE_MIGRATION_DISMISS_KEY) === '1';
}

export function shouldShowReconnectBanner(): boolean {
  return hasLegacyAuthArtifacts() && !isAuthCookieMigrationDismissed();
}

export function purgeLegacyAuthLocalStorage(): void {
  if (typeof localStorage === 'undefined') return;
  for (const key of LEGACY_AUTH_LOCAL_KEYS) {
    localStorage.removeItem(key);
  }
}

export function dismissAuthCookieMigrationBanner(): void {
  purgeLegacyAuthLocalStorage();
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(AUTH_COOKIE_MIGRATION_DISMISS_KEY, '1');
  }
}
