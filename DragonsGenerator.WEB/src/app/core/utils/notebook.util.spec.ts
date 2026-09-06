import { seedNotebookFromLegacyNotes, sessionNotebookFromPlay } from './notebook.util';
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
});
