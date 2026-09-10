import {
  CampaignSession,
  InkStroke,
  NOTEBOOK_INK_JPEG_QUALITY,
  NOTEBOOK_INK_MAX_DIMENSION,
  NotebookPage,
  SESSION_PLAY_PAD_MAX,
  SessionPlayPad,
  createNotebookPage,
  createSessionPlayPad,
} from '@core/models/Campaign/campaign';
import { ensurePadsHaveLayouts } from './pad-layout.util';

export function seedNotebookFromLegacyNotes(notes: string | undefined | null): NotebookPage[] {
  const trimmed = notes?.trim();
  if (!trimmed) return [];
  return [
    {
      id: 'legacy-notes',
      title: 'Notes du MJ',
      mode: 'text',
      text: trimmed,
      inkStrokes: [],
      updatedAt: new Date().toISOString(),
    },
  ];
}

export function ensureSessionResume(page?: NotebookPage | null): NotebookPage {
  if (page) {
    return { ...page, title: page.title?.trim() || 'Résumé' };
  }
  return createNotebookPage('Résumé');
}

/** Construit / migre les calepins depuis playNotebook / playNotes. */
export function ensureSessionPlayPads(session: CampaignSession): SessionPlayPad[] {
  const existing = session.playPads;
  if (existing?.length) {
    const sorted = [...existing]
      .map((p, i) => ({
        ...p,
        order: typeof p.order === 'number' ? p.order : i,
        title: p.title?.trim() || (p.kind === 'checklist' ? 'Liste' : p.page?.title || 'Notes'),
      }))
      .sort((a, b) => a.order - b.order);
    return ensurePadsHaveLayouts(sorted);
  }

  const page = sessionNotebookFromPlay(session.title, session.playNotes, session.playNotebook);
  return ensurePadsHaveLayouts([
    {
      id: page.id || 'session-live-notes',
      kind: 'note',
      title: page.title || `Session · ${session.title}`,
      order: 0,
      layout: { x: 0, y: 0, w: 12, h: 8 },
      page,
    },
  ]);
}

/** Aperçu texte des calepins (hub) — jamais une surface d’édition. */
export function sessionPlayPadsPreview(session: CampaignSession, maxLen = 280): string {
  const text = archivePlayPadsText(ensureSessionPlayPads(session)).trim();
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 1).trimEnd()}…`;
}

/** Ajoute un bloc texte au premier calepin note (ex. fin de combat). */
export function appendTextToFirstNotePad(pads: SessionPlayPad[], block: string): SessionPlayPad[] {
  const trimmed = block.trim();
  if (!trimmed) return pads;
  const sorted = [...pads].sort((a, b) => a.order - b.order);
  const targetIdx = sorted.findIndex((p) => p.kind === 'note' && p.page);
  if (targetIdx < 0) {
    const created = createSessionPlayPad('note', 'Notes', sorted.length);
    created.page = {
      ...created.page!,
      text: trimmed,
      updatedAt: new Date().toISOString(),
    };
    return ensurePadsHaveLayouts([...sorted, created].map((p, i) => ({ ...p, order: i })));
  }
  const target = sorted[targetIdx]!;
  const nextText = [target.page?.text?.trim(), trimmed].filter(Boolean).join('\n\n');
  return sorted.map((p, i) =>
    i === targetIdx && p.kind === 'note' && p.page
      ? {
          ...p,
          page: { ...p.page, text: nextText, updatedAt: new Date().toISOString() },
        }
      : p,
  );
}

export function syncLegacyPlayNotesFromPads(pads: SessionPlayPad[]): {
  playNotes: string;
  playNotebook: NotebookPage | undefined;
} {
  const sorted = [...pads].sort((a, b) => a.order - b.order);
  const firstNote = sorted.find((p) => p.kind === 'note' && p.page);
  if (!firstNote?.page) {
    return { playNotes: '', playNotebook: undefined };
  }
  return {
    playNotes: firstNote.page.text ?? '',
    playNotebook: {
      ...firstNote.page,
      title: firstNote.title || firstNote.page.title,
    },
  };
}

export function archivePlayPadsText(pads: SessionPlayPad[]): string {
  const blocks: string[] = [];
  for (const pad of [...pads].sort((a, b) => a.order - b.order)) {
    const title = pad.title?.trim() || (pad.kind === 'checklist' ? 'Liste' : 'Notes');
    if (pad.kind === 'checklist') {
      const lines = (pad.items ?? [])
        .map((it) => `${it.done ? '[x]' : '[ ]'} ${it.text || ''}`.trimEnd())
        .filter((l) => l !== '[ ]' && l !== '[x]');
      if (!lines.length) continue;
      blocks.push(`## ${title}\n${lines.join('\n')}`);
      continue;
    }
    const text = pad.page?.text?.trim();
    if (text) blocks.push(`## ${title}\n${text}`);
  }
  return blocks.join('\n\n');
}

export { SESSION_PLAY_PAD_MAX, createSessionPlayPad };

export function redrawInkStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: InkStroke[],
  clear = true,
): void {
  if (clear) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const stroke of strokes) {
    if (!stroke.points.length) continue;
    const isHi = stroke.tool === 'highlighter';
    const radius = Math.max(stroke.width / 2, isHi ? 3 : 1.75);
    ctx.globalAlpha = isHi ? 0.35 : 1;

    if (stroke.points.length === 1) {
      const p = stroke.points[0]!;
      ctx.beginPath();
      ctx.fillStyle = stroke.color;
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    const [first, ...rest] = stroke.points;
    ctx.moveTo(first!.x, first!.y);
    for (const p of rest) ctx.lineTo(p.x, p.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.fillStyle = stroke.color;
    ctx.arc(first!.x, first!.y, radius, 0, Math.PI * 2);
    ctx.fill();
    const last = stroke.points[stroke.points.length - 1]!;
    ctx.beginPath();
    ctx.arc(last.x, last.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/** Export canvas → JPEG data URL redimensionné pour limiter la taille JSON. */
export function exportInkDataUrl(
  source: HTMLCanvasElement,
  maxDimension = NOTEBOOK_INK_MAX_DIMENSION,
  quality = NOTEBOOK_INK_JPEG_QUALITY,
): string {
  const w = source.width || 1;
  const h = source.height || 1;
  const scale = Math.min(1, maxDimension / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));
  const out = document.createElement('canvas');
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext('2d');
  if (!ctx) return source.toDataURL('image/jpeg', quality);
  ctx.fillStyle = '#171b22';
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(source, 0, 0, outW, outH);
  return out.toDataURL('image/jpeg', quality);
}

export function sessionNotebookFromPlay(
  sessionTitle: string,
  playNotes: string | undefined,
  playNotebook: NotebookPage | undefined | null,
): NotebookPage {
  if (playNotebook) {
    return {
      ...playNotebook,
      text: playNotebook.text ?? playNotes ?? '',
      title: playNotebook.title || `Session · ${sessionTitle}`,
    };
  }
  return {
    id: 'session-live-notes',
    title: `Session · ${sessionTitle}`,
    mode: 'text',
    text: playNotes ?? '',
    inkStrokes: [],
    updatedAt: new Date().toISOString(),
  };
}
