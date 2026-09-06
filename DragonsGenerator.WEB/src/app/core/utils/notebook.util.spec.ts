import {
  redrawInkStrokes,
  seedNotebookFromLegacyNotes,
  sessionNotebookFromPlay,
} from './notebook.util';
import { createNotebookPage } from '@core/models/Campaign/campaign';

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
});
