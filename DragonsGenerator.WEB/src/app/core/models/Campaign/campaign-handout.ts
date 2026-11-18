export type HandoutKind = 'letter' | 'map' | 'summary' | 'other';

export const HANDOUT_KIND_LABELS: Record<HandoutKind, string> = {
  letter: 'Lettre',
  map: 'Carte',
  summary: 'Résumé',
  other: 'Autre',
};

/** Document / handout publiable par le MJ (sans spoiler). */
export interface CampaignHandoutPage {
  id: string;
  title: string;
  body: string;
  /** Page visible joueurs quand le document est publié. */
  published: boolean;
}

export interface CampaignHandout {
  id: string;
  title: string;
  body: string;
  kind: HandoutKind;
  published: boolean;
  publishedAt?: string;
  createdAt: string;
  updatedAt?: string;
  /** Notes MJ uniquement (jamais envoyées aux joueurs). */
  dmNotes?: string;
  /**
   * Pages de révélation progressive. Si absentes, `body` reste la seule page.
   * Publier le document expose les pages `published: true` (sinon tout le body).
   */
  pages?: CampaignHandoutPage[];
}

export function createCampaignHandout(title = 'Nouveau document'): CampaignHandout {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID?.() ?? `ho-${Date.now()}`,
    title,
    body: '',
    kind: 'other',
    published: false,
    createdAt: now,
    pages: [],
  };
}

export function createHandoutPage(title = 'Page'): CampaignHandoutPage {
  return {
    id: crypto.randomUUID?.() ?? `hop-${Date.now()}`,
    title,
    body: '',
    published: false,
  };
}

/** Corps joueur : pages publiées concaténées, sinon body. */
export function handoutPlayerBody(h: CampaignHandout): string {
  const pages = h.pages?.filter((p) => p.published) ?? [];
  if (pages.length) {
    return pages
      .map((p) => (p.title?.trim() ? `## ${p.title.trim()}\n\n${p.body}` : p.body))
      .join('\n\n---\n\n');
  }
  return h.body ?? '';
}

export function normalizeHandoutKind(raw: unknown): HandoutKind {
  if (raw === 'letter' || raw === 'map' || raw === 'summary' || raw === 'other') return raw;
  return 'other';
}
