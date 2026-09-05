/** Icône / emoji pour les animaux totem (druide Cercle des Esprits). */

export function animalTotemEmoji(...parts: Array<string | null | undefined>): string {
  const n = parts.filter(Boolean).join(' ').toLowerCase();
  if (/crocodil|alligator/.test(n)) return '🐊';
  if (/serpent|snake|vip[eè]re/.test(n)) return '🐍';
  if (/ours|bear/.test(n)) return '🐻';
  if (/aigle|eagle|faucon|hawk/.test(n)) return '🦅';
  if (/cerf|elk|deer|chevreuil/.test(n)) return '🦌';
  if (/chat|panth|tigre|lion|f[eé]lin|cougar|lynx/.test(n)) return '🐈';
  if (/corbeau|raven|crow|hibou|chouette|owl|oiseau|bird/.test(n)) return '🐦';
  if (/cheval|horse|poney/.test(n)) return '🐴';
  if (/sanglier|boar|porc/.test(n)) return '🐗';
  if (/requin|shark/.test(n)) return '🦈';
  if (/araign|spider/.test(n)) return '🕷️';
  if (/grenouille|frog|crapaud/.test(n)) return '🐸';
  if (/rat|souris|mouse/.test(n)) return '🐀';
  if (/dauphin|dolphin/.test(n)) return '🐬';
  if (/abeille|bee|gu[eê]pe/.test(n)) return '🐝';
  if (/loup|wolf/.test(n)) return '🐺';
  return '🐾';
}

/** Iconify fluent-emoji (secours) — préférer animalTotemEmoji à l’affichage. */
export function animalTotemIconify(...parts: Array<string | null | undefined>): string {
  const n = parts.filter(Boolean).join(' ').toLowerCase();
  if (/crocodil|alligator/.test(n)) return 'fluent-emoji:crocodile';
  if (/serpent|snake|vip[eè]re/.test(n)) return 'fluent-emoji:snake';
  if (/ours|bear/.test(n)) return 'fluent-emoji:bear';
  if (/aigle|eagle|faucon|hawk/.test(n)) return 'fluent-emoji:eagle';
  if (/cerf|elk|deer|chevreuil/.test(n)) return 'fluent-emoji:deer';
  if (/chat|panth|tigre|lion|f[eé]lin|cougar|lynx/.test(n)) return 'fluent-emoji:cat';
  if (/corbeau|raven|crow|hibou|chouette|owl|oiseau|bird/.test(n)) return 'fluent-emoji:bird';
  if (/cheval|horse|poney/.test(n)) return 'fluent-emoji:horse';
  if (/sanglier|boar|porc/.test(n)) return 'fluent-emoji:boar';
  if (/requin|shark/.test(n)) return 'fluent-emoji:shark';
  if (/araign|spider/.test(n)) return 'fluent-emoji:spider';
  if (/grenouille|frog|crapaud/.test(n)) return 'fluent-emoji:frog';
  if (/rat|souris|mouse/.test(n)) return 'fluent-emoji:rat';
  if (/dauphin|dolphin/.test(n)) return 'fluent-emoji:dolphin';
  if (/abeille|bee|gu[eê]pe/.test(n)) return 'fluent-emoji:honeybee';
  if (/loup|wolf/.test(n)) return 'fluent-emoji:wolf';
  return 'fluent-emoji:paw-prints';
}
