import {
  appendTextToFirstNotePad,
  archivePlayPadsText,
  ensureSessionPlayPads,
  ensureSessionResume,
  exportInkDataUrl,
  redrawInkStrokes,
  seedNotebookFromLegacyNotes,
  sessionNotebookFromPlay,
  sessionPlayPadsPreview,
  syncLegacyPlayNotesFromPads,
} from './notebook.util';
import {
  CampaignSession,
  createChecklistItem,
  createNotebookPage,
  createSessionPlayPad,
  SessionPlayPad,
} from '@core/models/Campaign/campaign';

function session(partial: Partial<CampaignSession> = {}): CampaignSession {
  return {
    id: 's1',
    title: 'Soirée 1',
    scheduledAt: new Date().toISOString(),
    status: 'planned',
    ...partial,
  };
}

describe('notebook.util', () => {
  it('seeds a text page from legacy notes', () => {
    const pages = seedNotebookFromLegacyNotes('  Hello MJ  ');
    expect(pages.length).toBe(1);
    expect(pages[0]!.text).toBe('Hello MJ');
    expect(pages[0]!.mode).toBe('text');
  });

  it('returns empty seed when notes blank', () => {
    expect(seedNotebookFromLegacyNotes('')).toEqual([]);
    expect(seedNotebookFromLegacyNotes(null)).toEqual([]);
  });

  it('builds a stable session notebook page', () => {
    const a = sessionNotebookFromPlay('Soirée 1', 'note A', null);
    const b = sessionNotebookFromPlay('Soirée 1', 'note A', null);
    expect(a.id).toBe(b.id);
    expect(a.text).toBe('note A');
  });

  it('prefers existing playNotebook', () => {
    const existing = createNotebookPage('Live');
    existing.mode = 'ink';
    existing.text = 'from notebook';
    const page = sessionNotebookFromPlay('Soirée', 'from playNotes', existing);
    expect(page.mode).toBe('ink');
    expect(page.text).toBe('from notebook');
  });

  it('ensureSessionResume keeps title or defaults', () => {
    expect(ensureSessionResume(null).title).toBe('Résumé');
    expect(ensureSessionResume(createNotebookPage('  ')).title).toBe('Résumé');
    expect(ensureSessionResume(createNotebookPage('Arc')).title).toBe('Arc');
  });

  it('ensureSessionPlayPads migrates from playNotes', () => {
    const pads = ensureSessionPlayPads(session({ playNotes: 'hello' }));
    expect(pads.length).toBe(1);
    expect(pads[0]!.kind).toBe('note');
    expect(pads[0]!.page?.text).toBe('hello');
    expect(pads[0]!.layout?.w).toBe(12);
  });

  it('ensureSessionPlayPads normalizes existing pads order and titles', () => {
    const padsIn: SessionPlayPad[] = [
      {
        id: 'b',
        kind: 'checklist',
        title: '  ',
        order: 2,
        items: [createChecklistItem('x')],
      },
      {
        id: 'a',
        kind: 'note',
        title: '',
        order: 0,
        page: createNotebookPage('Page'),
      },
    ];
    const pads = ensureSessionPlayPads(session({ playPads: padsIn }));
    expect(pads.map((p) => p.id)).toEqual(['a', 'b']);
    expect(pads[0]!.title).toBe('Page');
    expect(pads[1]!.title).toBe('Liste');
    expect(pads[0]!.layout).toBeTruthy();
    expect(pads[1]!.layout).toBeTruthy();
  });

  it('createSessionPlayPad builds note and checklist', () => {
    const note = createSessionPlayPad('note', 'N', 0);
    const list = createSessionPlayPad('checklist', undefined, 1);
    expect(note.kind).toBe('note');
    expect(note.page?.title).toBe('N');
    expect(note.layout?.w).toBe(6);
    expect(list.kind).toBe('checklist');
    expect(list.title).toBe('Liste');
    expect(list.items?.length).toBe(1);
  });

  it('syncLegacyPlayNotesFromPads mirrors first note pad', () => {
    const note = createSessionPlayPad('note', 'Main', 0);
    note.page = { ...note.page!, text: 'body' };
    const list = createSessionPlayPad('checklist', 'Todo', 1);
    const synced = syncLegacyPlayNotesFromPads([list, note]);
    expect(synced.playNotes).toBe('body');
    expect(synced.playNotebook?.title).toBe('Main');
  });

  it('syncLegacyPlayNotesFromPads handles no note pads', () => {
    const synced = syncLegacyPlayNotesFromPads([createSessionPlayPad('checklist', 'L', 0)]);
    expect(synced.playNotes).toBe('');
    expect(synced.playNotebook).toBeUndefined();
  });

  it('appendTextToFirstNotePad appends to first note', () => {
    const note = createSessionPlayPad('note', 'Main', 0);
    note.page = { ...note.page!, text: 'scene' };
    const list = createSessionPlayPad('checklist', 'Todo', 1);
    const next = appendTextToFirstNotePad([list, note], '--- Fin combat ---');
    const main = next.find((p) => p.id === note.id)!;
    expect(main.page?.text).toContain('scene');
    expect(main.page?.text).toContain('--- Fin combat ---');
    expect(next.find((p) => p.id === list.id)?.kind).toBe('checklist');
  });

  it('appendTextToFirstNotePad creates a note pad when none exist', () => {
    const list = createSessionPlayPad('checklist', 'Todo', 0);
    const next = appendTextToFirstNotePad([list], 'archive only');
    expect(next.length).toBe(2);
    expect(next.some((p) => p.kind === 'note' && p.page?.text === 'archive only')).toBe(true);
  });

  it('sessionPlayPadsPreview truncates long archives', () => {
    const note = createSessionPlayPad('note', 'Scène', 0);
    note.page = { ...note.page!, text: 'x'.repeat(400) };
    const preview = sessionPlayPadsPreview(
      session({ playPads: [note], playNotes: '' }),
      80,
    );
    expect(preview.length).toBeLessThanOrEqual(80);
    expect(preview.endsWith('…')).toBe(true);
  });

  it('archivePlayPadsText concatenates notes and checklists', () => {
    const note = createSessionPlayPad('note', 'Scène', 0);
    note.page = { ...note.page!, text: 'Les joueurs fuient' };
    const list = createSessionPlayPad('checklist', 'Todo', 1);
    list.items = [
      { id: '1', text: 'Loot', done: true },
      { id: '2', text: '  ', done: false },
      { id: '3', text: 'PNJ', done: false },
    ];
    const empty = createSessionPlayPad('note', 'Vide', 2);
    empty.page = { ...empty.page!, text: '   ' };
    const text = archivePlayPadsText([empty, list, note]);
    expect(text).toContain('## Scène');
    expect(text).toContain('Les joueurs fuient');
    expect(text).toContain('[x] Loot');
    expect(text).toContain('[ ] PNJ');
    expect(text).not.toContain('## Vide');
  });

  it('draws a visible filled circle for a single-point stroke', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d')!;
    redrawInkStrokes(ctx, [{ color: '#ffffff', width: 4, points: [{ x: 20, y: 20 }] }], true);
    const pixel = ctx.getImageData(20, 20, 1, 1).data;
    expect(pixel[0]).toBeGreaterThan(200);
    expect(pixel[3]).toBeGreaterThan(200);
  });

  it('redraws multi-point and highlighter strokes', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d')!;
    redrawInkStrokes(
      ctx,
      [
        {
          color: '#fbbf24',
          width: 8,
          tool: 'highlighter',
          points: [
            { x: 5, y: 5 },
            { x: 20, y: 20 },
          ],
        },
        { color: '#fff', width: 2, points: [] },
      ],
      true,
    );
    expect(ctx).toBeTruthy();
  });

  it('exportInkDataUrl returns a jpeg data url', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 10;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#123456';
    ctx.fillRect(0, 0, 20, 10);
    const url = exportInkDataUrl(canvas, 8);
    expect(url.startsWith('data:image/jpeg')).toBe(true);
  });
});
