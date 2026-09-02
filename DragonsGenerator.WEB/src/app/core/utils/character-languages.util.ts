/** Convertit un ID langue (lg-*) en libellé lisible. */
export function normalizeLanguageName(lang: string): string {
  if (lang.startsWith('lg-')) {
    return lang
      .replace(/^lg-/, '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return lang;
}

/** Fusionne des listes de langues (normalisées, sans doublon). */
export function mergeCreationLanguages(...sources: string[][]): string[] {
  return [
    ...new Set(sources.flatMap((list) => list.map((l) => normalizeLanguageName(l)))),
  ];
}
