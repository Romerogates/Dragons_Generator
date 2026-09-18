/** Sections fixes produites par l’IA (GenerateAdventureEndpoint / AdventureOutputCleaner). */
export const ADVENTURE_SECTION_TITLES = [
  'Accroche',
  'Contexte',
  'Personnages clés',
  'Acte 1',
  'Acte 2',
  'Acte 3',
  'Pistes pour le MJ',
] as const;

export type AdventureSectionTitle = (typeof ADVENTURE_SECTION_TITLES)[number];

export interface AdventureSection {
  title: AdventureSectionTitle | string;
  body: string;
  /** Lignes bullet détectées (Personnages clés, pistes…). */
  bullets: string[];
}

const TITLE_ALT = ADVENTURE_SECTION_TITLES.map((t) =>
  t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
).join('|');

/** En-tête **Titre** — corps… ou *Titre*: … (ne traverse pas les sauts de ligne). */
const SECTION_HEADER = new RegExp(
  `^[\\*_\\t ]*(?:\\*\\*(?<titleBold>${TITLE_ALT})\\*\\*|\\*(?<titleItalic>${TITLE_ALT})\\*:)[^\\S\\n]*[—\\-–:]?[^\\S\\n]*(?<body>.*)$`,
  'gim',
);

/**
 * Découpe le texte d’aventure IA en sections stables.
 * Si aucune balise reconnue : une seule section « Synopsis ».
 */
export function parseAdventureSections(raw: string | null | undefined): AdventureSection[] {
  const text = (raw ?? '').trim();
  if (!text) return [];

  const re = new RegExp(SECTION_HEADER.source, SECTION_HEADER.flags);
  const matches = [...text.matchAll(re)];
  if (matches.length === 0) {
    return [{ title: 'Synopsis', body: text, bullets: extractBullets(text) }];
  }

  const sections: AdventureSection[] = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const title = (m.groups?.['titleBold'] || m.groups?.['titleItalic'] || '').trim();
    if (!title) continue;
    const inlineBody = (m.groups?.['body'] ?? '').trim();
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? (matches[i + 1].index ?? text.length) : text.length;
    const block = text.slice(start, end).trim();
    const combined = [inlineBody, block].filter(Boolean).join('\n').trim();
    const bullets = extractBullets(combined);
    const plain = stripLeadingBulletsAsPlain(combined);
    if (!plain && bullets.length === 0) continue;
    if (sections.some((s) => s.title === title)) continue;
    sections.push({
      title,
      body: plain,
      bullets,
    });
  }

  if (sections.length === 0) {
    return [{ title: 'Synopsis', body: text, bullets: extractBullets(text) }];
  }

  return sections.sort((a, b) => {
    const ia = ADVENTURE_SECTION_TITLES.indexOf(a.title as AdventureSectionTitle);
    const ib = ADVENTURE_SECTION_TITLES.indexOf(b.title as AdventureSectionTitle);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

function extractBullets(body: string): string[] {
  const lines = body.split('\n');
  const bullets: string[] = [];
  for (const line of lines) {
    const m = line.trim().match(/^[-*•]\s+(.+)$/);
    if (m?.[1]) bullets.push(m[1].replace(/^\*\*(.+?)\*\*/, '$1').trim());
  }
  return bullets;
}

/** Corps sans les bullets si on les affiche à part (évite doublon). */
function stripLeadingBulletsAsPlain(body: string): string {
  const lines = body.split('\n');
  const nonBullet = lines.filter((l) => !/^\s*[-*•]\s+/.test(l));
  const joined = nonBullet.join('\n').trim();
  // Si tout était des bullets, body vide → l’UI n’affiche que la liste
  return joined;
}
