import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { PATCH_NOTES, type PatchNote } from '@core/data/patch-notes';
import { PatchNotesPage } from '@features/patch-notes/patch-notes';
import { PatchNotesList } from './patch-notes-list';

const notes: PatchNote[] = [
  { version: '1.2', date: '2026-10-09', title: 'Récent', player: ['Joueur A'], tech: ['Tech A'] },
  { version: '1.1', date: 'bad-date', title: 'Interne', player: [], tech: ['Tech B'] },
];

describe('PatchNotesList', () => {
  async function render(audience: 'player' | 'tech') {
    await TestBed.configureTestingModule({
      imports: [PatchNotesList],
      providers: [...zonelessTestProviders],
    }).compileComponents();
    const fixture = TestBed.createComponent(PatchNotesList);
    fixture.componentRef.setInput('audience', audience);
    fixture.componentRef.setInput('notes', notes);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows player items and skips versions without player changes', async () => {
    const el = await render('player');
    expect(el.textContent).toContain('Joueur A');
    expect(el.textContent).toContain('Dernière version');
    expect(el.textContent).not.toContain('Tech A');
    expect(el.querySelectorAll('ol > li').length).toBe(1);
  });

  it('shows technical items for support and keeps unparsable dates', async () => {
    const el = await render('tech');
    expect(el.textContent).toContain('Tech A');
    expect(el.textContent).toContain('Tech B');
    expect(el.textContent).toContain('bad-date');
  });
});

describe('PATCH_NOTES data', () => {
  it('is newest first with unique versions and player-safe wording', () => {
    const versions = PATCH_NOTES.map((n) => Number(n.version.split('.')[1]));
    expect([...versions].sort((a, b) => b - a)).toEqual(versions);
    expect(new Set(versions).size).toBe(versions.length);
    const playerText = PATCH_NOTES.flatMap((n) => n.player).join(' ');
    expect(playerText).not.toMatch(/`|endpoint|localStorage|migration|docker|\bAPI\b|\.ts\b/i);
  });
});

describe('PatchNotesPage', () => {
  it('renders the public list', async () => {
    await TestBed.configureTestingModule({
      imports: [PatchNotesPage],
      providers: [...zonelessTestProviders, provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(PatchNotesPage);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Nouveautés');
    expect(el.textContent).toContain(PATCH_NOTES[0].player[0]);
  });
});
