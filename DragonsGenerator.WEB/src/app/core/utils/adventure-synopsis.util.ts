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

/**
 * Sections éditables dans le wizard : toujours les 7 titres IA,
 * préremplies depuis le texte (ou Accroche si synopsis libre).
 */
export function adventureSectionsForEdit(raw: string | null | undefined): AdventureSection[] {
  const parsed = parseAdventureSections(raw);
  const byTitle = new Map(parsed.map((s) => [s.title, s]));

  if (parsed.length === 1 && parsed[0]!.title === 'Synopsis') {
    const syn = parsed[0]!;
    return ADVENTURE_SECTION_TITLES.map((title, i) =>
      i === 0
        ? { title, body: syn.body, bullets: syn.bullets }
        : { title, body: '', bullets: [] },
    );
  }

  return ADVENTURE_SECTION_TITLES.map((title) => {
    const s = byTitle.get(title);
    return s ? { title, body: s.body, bullets: s.bullets } : { title, body: '', bullets: [] };
  });
}

/** Recompose le blob markdown attendu par l’API / le stockage campagne. */
export function serializeAdventureSections(sections: AdventureSection[]): string {
  return sections
    .map((s) => {
      const title = s.title.trim();
      const body = s.body.trim();
      const bullets = s.bullets.map((b) => b.trim()).filter(Boolean);
      if (!body && bullets.length === 0) return '';
      const lines: string[] = [];
      if (body) {
        lines.push(`**${title}** — ${body}`);
      } else {
        lines.push(`**${title}**`);
      }
      for (const b of bullets) lines.push(`- ${b}`);
      return lines.join('\n');
    })
    .filter(Boolean)
    .join('\n\n');
}

/** Met à jour le corps (texte libre) d’une section ; les lignes « - » deviennent des bullets. */
export function patchAdventureSection(
  raw: string,
  title: AdventureSectionTitle | string,
  value: string,
): string {
  const sections = adventureSectionsForEdit(raw);
  const idx = sections.findIndex((s) => s.title === title);
  if (idx < 0) return raw;
  const lines = value.replace(/\r\n/g, '\n').split('\n');
  const bullets: string[] = [];
  const prose: string[] = [];
  for (const line of lines) {
    const m = line.trim().match(/^[-*•]\s+(.+)$/);
    if (m?.[1]) bullets.push(m[1].trim());
    else if (line.trim()) prose.push(line);
  }
  sections[idx] = {
    title,
    body: prose.join('\n').trim(),
    bullets,
  };
  return serializeAdventureSections(sections);
}

/** Valeur affichée dans le textarea d’édition (corps + bullets). */
export function adventureSectionEditorValue(section: AdventureSection): string {
  const parts: string[] = [];
  if (section.body.trim()) parts.push(section.body.trim());
  for (const b of section.bullets) parts.push(`- ${b}`);
  return parts.join('\n');
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
