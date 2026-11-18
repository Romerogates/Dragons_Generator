export type NotebookMode = 'text' | 'ink';

export interface InkPoint {
  x: number;
  y: number;
}

export interface InkStroke {
  color: string;
  width: number;
  points: InkPoint[];
  /** pen = trait opaque ; highlighter = semi-transparent */
  tool?: 'pen' | 'highlighter';
}

/** Page du carnet MJ (clavier et/ou stylet). */
export interface NotebookPage {
  id: string;
  title: string;
  mode: NotebookMode;
  text?: string;
  inkStrokes?: InkStroke[];
  /** Aperçu compressé (JPEG data URL) — pas d’OCR en V1. */
  inkImageDataUrl?: string;
  updatedAt: string;
}

export interface SessionChecklistItem {
  id: string;
  text: string;
  done?: boolean;
}

export type SessionPlayPadKind = 'note' | 'checklist';

/** @deprecated Prefer layout cells; kept for migration. */
export type SessionPlayPadWidgetSize = 'third' | 'half' | 'full';

/** Position / taille sur grille 12 colonnes. */
export interface SessionPlayPadLayout {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SessionPlayPad {
  id: string;
  kind: SessionPlayPadKind;
  title: string;
  order?: number;
  /** @deprecated Migrated to layout. */
  widgetSize?: SessionPlayPadWidgetSize;
  /** Grille aimantée (x,y,w,h en cellules). */
  layout?: SessionPlayPadLayout;
  page?: NotebookPage;
  items?: SessionChecklistItem[];
}

export const SESSION_PLAY_PAD_MAX = 8;

/** Plafond soft pour éviter d’exploser le JSON campagne. */
export const NOTEBOOK_MAX_PAGES = 24;
export const NOTEBOOK_INK_MAX_DIMENSION = 1280;
export const NOTEBOOK_INK_JPEG_QUALITY = 0.55;

export function createNotebookPage(title = 'Nouvelle page'): NotebookPage {
  return {
    id: crypto.randomUUID?.() ?? `nb-${Date.now()}`,
    title,
    mode: 'text',
    text: '',
    inkStrokes: [],
    updatedAt: new Date().toISOString(),
  };
}

export function createChecklistItem(text = ''): SessionChecklistItem {
  return {
    id: crypto.randomUUID?.() ?? `cli-${Date.now()}`,
    text,
    done: false,
  };
}

export function createSessionPlayPad(
  kind: SessionPlayPadKind,
  title?: string,
  order = 0,
  layout?: SessionPlayPadLayout,
): SessionPlayPad {
  const id = crypto.randomUUID?.() ?? `pad-${Date.now()}`;
  const resolvedLayout = layout ?? { x: (order % 2) * 6, y: Math.floor(order / 2) * 6, w: 6, h: 6 };
  if (kind === 'checklist') {
    return {
      id,
      kind,
      title: title ?? 'Liste',
      order,
      layout: resolvedLayout,
      items: [createChecklistItem('')],
    };
  }
  const page = createNotebookPage(title ?? 'Notes');
  return {
    id,
    kind: 'note',
    title: page.title,
    order,
    layout: resolvedLayout,
    page,
  };
}
