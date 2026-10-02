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

/** Catégories catalogue (fallback validation wizard sans DataService). */
const BASE_LANGUAGE_NAMES = new Set([
  'Arolave',
  'Aupuniwi',
  'Baashan',
  'Cyfand',
  'Commun',
  'Cyrillan',
  'Elfique',
  'Gnome',
  'Gobelin',
  'Inkulomo',
  'Kaani',
  'Kalam',
  'Karphûd',
  'Lothrien',
  'Nain',
  'Nordique',
  'Runasimi',
  'Shi-huang',
]);

const EXOTIC_LANGUAGE_NAMES = new Set([
  'Démoniaque',
  'Céleste',
  'Commun des profondeurs',
  'Draconique',
  'Diabolique',
  'Originel',
  'Profond',
  'Sylvestre',
  'Tumiit',
  'Viatique',
]);

export function isBaseLanguageName(name: string): boolean {
  return BASE_LANGUAGE_NAMES.has(normalizeLanguageName(name));
}

export function isExoticLanguageName(name: string): boolean {
  return EXOTIC_LANGUAGE_NAMES.has(normalizeLanguageName(name));
}
