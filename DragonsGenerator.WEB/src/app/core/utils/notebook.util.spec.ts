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
import { boardRowCount, ensurePadsHaveLayouts, findFreeLayout, padGridStyle } from './pad-layout.util';
import {
  CampaignSession,
  NOTEBOOK_INK_JPEG_QUALITY,
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

  it('appendTextToFirstNotePad ignores blank blocks', () => {
    const note = createSessionPlayPad('note', 'Main', 0);
    note.page = { ...note.page!, text: 'scene' };
    const pads = [note];
    const next = appendTextToFirstNotePad(pads, '   ');
    expect(next).toBe(pads);
    expect(next[0]!.page?.text).toBe('scene');
  });

  it('ensureSessionPlayPads falls back to index order and default titles', () => {
    const padsIn: SessionPlayPad[] = [
      {
        id: 'check',
        kind: 'checklist',
        title: '  ',
        order: undefined as never,
        items: [createChecklistItem('x')],
      },
      {
        id: 'note',
        kind: 'note',
        title: '',
        order: undefined as never,
        page: { ...createNotebookPage(''), title: '' },
      },
    ];
    const pads = ensureSessionPlayPads(session({ playPads: padsIn }));
    expect(pads.map((p) => p.id)).toEqual(['check', 'note']);
    expect(pads[0]!.order).toBe(0);
    expect(pads[1]!.order).toBe(1);
    expect(pads[0]!.title).toBe('Liste');
    expect(pads[1]!.title).toBe('Notes');
  });

  it('ensureSessionPlayPads migrates legacy playNotes when no pads exist', () => {
    const pads = ensureSessionPlayPads(session({ playNotes: 'legacy body', playPads: undefined }));
    expect(pads.length).toBe(1);
    expect(pads[0]!.page?.text).toBe('legacy body');
    expect(pads[0]!.title).toBe('Session · Soirée 1');
  });

  it('sessionPlayPadsPreview returns empty for blank archives and keeps short text intact', () => {
    expect(sessionPlayPadsPreview(session({ playNotes: '   ' }))).toBe('');
    const note = createSessionPlayPad('note', 'Scène', 0);
    note.page = { ...note.page!, text: 'Court résumé' };
    expect(sessionPlayPadsPreview(session({ playPads: [note] }), 280)).toBe('## Scène\nCourt résumé');
  });

  it('archivePlayPadsText skips empty checklists and whitespace-only notes', () => {
    const emptyChecklist = createSessionPlayPad('checklist', 'Todo', 0);
    emptyChecklist.items = [
      { id: '1', text: ' ', done: false },
      { id: '2', text: '', done: true },
    ];
    const whitespaceNote = createSessionPlayPad('note', 'Vide', 1);
    whitespaceNote.page = { ...whitespaceNote.page!, text: '   ' };
    expect(archivePlayPadsText([emptyChecklist, whitespaceNote])).toBe('');
  });

  it('syncLegacyPlayNotesFromPads treats undefined page text as empty', () => {
    const note = createSessionPlayPad('note', 'Main', 0);
    note.page = { ...note.page!, text: undefined as never };
    const synced = syncLegacyPlayNotesFromPads([note]);
    expect(synced.playNotes).toBe('');
    expect(synced.playNotebook?.title).toBe('Main');
  });

  it('redrawInkStrokes can skip clearing the canvas', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d')!;
    const clearSpy = spyOn(ctx, 'clearRect').and.callThrough();
    redrawInkStrokes(
      ctx,
      [{ color: '#ffffff', width: 4, points: [{ x: 20, y: 20 }] }],
      false,
    );
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it('exportInkDataUrl falls back to the source canvas when the offscreen context is unavailable', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 20;
    canvas.height = 10;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#abcdef';
    ctx.fillRect(0, 0, 20, 10);
    const offscreen = document.createElement('canvas');
    spyOn(document, 'createElement').and.returnValue(offscreen);
    spyOn(offscreen, 'getContext').and.returnValue(null);
    const fallbackSpy = spyOn(canvas, 'toDataURL').and.callThrough();
    const url = exportInkDataUrl(canvas);
    expect(url.startsWith('data:image/jpeg')).toBe(true);
    expect(fallbackSpy).toHaveBeenCalledWith('image/jpeg', NOTEBOOK_INK_JPEG_QUALITY);
  });

  it('sessionNotebookFromPlay defaults an empty playNotebook title', () => {
    const existing = createNotebookPage('');
    existing.text = 'ink body';
    const page = sessionNotebookFromPlay('Soirée 2', 'fallback', existing);
    expect(page.title).toBe('Session · Soirée 2');
    expect(page.text).toBe('ink body');
  });

  it('ensureSessionPlayPads migration uses session title fallbacks', () => {
    const pads = ensureSessionPlayPads(session({ title: 'Arc 3', playNotes: 'notes' }));
    expect(pads[0]!.id).toBeTruthy();
    expect(pads[0]!.title).toBe('Session · Arc 3');
  });

  it('syncLegacyPlayNotesFromPads falls back to page title when pad title is blank', () => {
    const note = createSessionPlayPad('note', '', 0);
    note.page = { ...note.page!, text: 'body', title: 'Page title' };
    const synced = syncLegacyPlayNotesFromPads([note]);
    expect(synced.playNotebook?.title).toBe('Page title');
  });

  it('archivePlayPadsText skips checklist rows that are only empty markers', () => {
    const list = createSessionPlayPad('checklist', 'Todo', 0);
    list.items = [{ id: '1', text: '', done: true }];
    expect(archivePlayPadsText([list])).toBe('');
  });

  it('sessionNotebookFromPlay falls back to playNotes when notebook text is missing', () => {
    const existing = createNotebookPage('Live');
    existing.text = undefined as never;
    const page = sessionNotebookFromPlay('Soirée', 'from notes', existing);
    expect(page.text).toBe('from notes');
  });

  it('ensureSessionPlayPads migration fills missing notebook id and title', () => {
    const nb = createNotebookPage('');
    nb.id = '';
    nb.text = 'live ink';
    const pads = ensureSessionPlayPads(session({ playNotebook: nb, playNotes: 'legacy' }));
    expect(pads[0]!.id).toBe('session-live-notes');
    expect(pads[0]!.title).toBe('Session · Soirée 1');
    expect(pads[0]!.page?.text).toBe('live ink');
  });

  it('sessionNotebookFromPlay without notebook uses playNotes text', () => {
    const page = sessionNotebookFromPlay('Arc', 'plain notes', null);
    expect(page.text).toBe('plain notes');
    expect(page.title).toBe('Session · Arc');
  });

  it('pad layout helpers cover overlap and fallback placement', () => {
    const occupied: { x: number; y: number; w: number; h: number }[] = [];
    for (let y = 0; y < 90; y++) {
      occupied.push({ x: 0, y, w: 6, h: 3 });
      occupied.push({ x: 6, y, w: 6, h: 3 });
    }
    const fallback = findFreeLayout(6, 4, occupied, 0);
    expect(fallback).toEqual({ x: 0, y: 80, w: 6, h: 4 });
    expect(boardRowCount([{ layout: { x: 0, y: 10, w: 6, h: 4 } }])).toBeGreaterThan(10);
    expect(padGridStyle({ x: 1, y: 2, w: 4, h: 3 })).toEqual({
      gridColumn: '2 / span 4',
      gridRow: '3 / span 3',
    });
  });

  it('archivePlayPadsText uses default checklist title when pad title is blank', () => {
    const list = createSessionPlayPad('checklist', '', 0);
    list.items = [{ id: '1', text: 'Buy rope', done: false }];
    expect(archivePlayPadsText([list])).toContain('## Liste');
  });

  it('archivePlayPadsText uses default note title and keeps checked checklist rows', () => {
    const note = createSessionPlayPad('note', '', 0);
    note.page = { ...note.page!, text: 'Ink notes' };
    const list = createSessionPlayPad('checklist', 'Tasks', 1);
    list.items = [{ id: '1', text: 'Done task', done: true }];
    const text = archivePlayPadsText([note, list]);
    expect(text).toContain('## Notes');
    expect(text).toContain('[x] Done task');
  });

  it('ensureSessionPlayPads migration uses session title when notebook page title is blank', () => {
    const nb = createNotebookPage('');
    nb.text = 'live';
    const pads = ensureSessionPlayPads(session({ title: 'Chapitre 4', playNotebook: nb }));
    expect(pads[0]!.title).toBe('Session · Chapitre 4');
  });

  it('sessionNotebookFromPlay defaults missing playNotes to empty string', () => {
    const page = sessionNotebookFromPlay('Arc', undefined, null);
    expect(page.text).toBe('');
  });

  it('ensurePadsHaveLayouts assigns order from index when missing', () => {
    const pads = ensurePadsHaveLayouts([
      { id: 'a', kind: 'note', title: 'A', widgetSize: 'half' } as unknown as SessionPlayPad,
      { id: 'b', kind: 'checklist', title: 'B', widgetSize: 'half', items: [] } as unknown as SessionPlayPad,
    ]);
    expect(pads[0]!.order).toBe(0);
    expect(pads[1]!.order).toBe(1);
    expect(pads[0]!.layout).toBeTruthy();
    expect(boardRowCount([{}])).toBe(8);
  });

  it('redrawInkStrokes clears by default before drawing', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 40, 40);
    const clearSpy = spyOn(ctx, 'clearRect').and.callThrough();
    redrawInkStrokes(ctx, [{ color: '#000000', width: 2, points: [{ x: 1, y: 1 }, { x: 5, y: 5 }] }]);
    expect(clearSpy).toHaveBeenCalled();
  });
});
