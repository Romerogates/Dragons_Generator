import {
  InkStroke,
  NOTEBOOK_INK_JPEG_QUALITY,
  NOTEBOOK_INK_MAX_DIMENSION,
  NotebookPage,
} from '@core/models/Campaign/campaign';

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
    const radius = Math.max(stroke.width / 2, 1.75);

    // Tap / point isolé : disque plein (un trait de 0.01px disparaît sinon).
    if (stroke.points.length === 1) {
      const p = stroke.points[0]!;
      ctx.beginPath();
      ctx.fillStyle = stroke.color;
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    const [first, ...rest] = stroke.points;
    ctx.moveTo(first!.x, first!.y);
    for (const p of rest) ctx.lineTo(p.x, p.y);
    ctx.stroke();

    // Arrondi net au départ / fin
    ctx.beginPath();
    ctx.fillStyle = stroke.color;
    ctx.arc(first!.x, first!.y, radius, 0, Math.PI * 2);
    ctx.fill();
    const last = stroke.points[stroke.points.length - 1]!;
    ctx.beginPath();
    ctx.arc(last.x, last.y, radius, 0, Math.PI * 2);
    ctx.fill();
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
