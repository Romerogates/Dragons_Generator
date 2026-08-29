/** Supprime les données locales Dragons Generator (hors ligne, auth, brouillons). */
export function clearLocalAppData(): void {
  if (typeof localStorage === 'undefined') return;
  const prefixes = ['dragons', 'dragon_'];
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
