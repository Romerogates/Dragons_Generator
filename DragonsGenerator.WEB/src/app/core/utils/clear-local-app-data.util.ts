/** Supprime les données locales Dragons Generator (hors ligne, auth legacy, brouillons). */
export function clearLocalAppData(): void {
  const prefixes = ['dragons', 'dragon_'];
  if (typeof localStorage !== 'undefined') {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (prefixes.some((p) => key.startsWith(p))) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  }
  if (typeof sessionStorage !== 'undefined') {
    const sessionKeys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key) continue;
      if (prefixes.some((p) => key.startsWith(p))) {
        sessionKeys.push(key);
      }
    }
    for (const key of sessionKeys) {
      sessionStorage.removeItem(key);
    }
  }
}
