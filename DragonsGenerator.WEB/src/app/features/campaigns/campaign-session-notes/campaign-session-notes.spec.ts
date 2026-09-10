import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CampaignSessionNotes } from './campaign-session-notes';
import {
  CampaignSession,
  createNotebookPage,
  createSessionPlayPad,
} from '@core/models/Campaign/campaign';
import { DataService } from '@core/services/data.service';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { of } from 'rxjs';

describe('CampaignSessionNotes', () => {
  let fixture: ComponentFixture<CampaignSessionNotes>;
  let component: CampaignSessionNotes;

  const baseSession: CampaignSession = {
    id: 's1',
    title: 'Table',
    scheduledAt: new Date().toISOString(),
    status: 'planned',
    playNotes: 'legacy',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CampaignSessionNotes],
      providers: [
        ...zonelessTestProviders,
        {
          provide: DataService,
          useValue: { transcribeNotebook: () => of({ text: 'ocr' }) },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CampaignSessionNotes);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('session', baseSession);
    fixture.componentRef.setInput('sessionResume', null);
    fixture.detectChanges();
  });

  it('exposes a resume page and migrated pads', () => {
    expect(component.resumePage().title).toBe('Résumé');
    expect(component.pads().length).toBe(1);
    expect(component.pads()[0]!.page?.text).toBe('legacy');
  });

  it('emits resume changes', () => {
    const spy = jasmine.createSpy('resume');
    component.resumeChange.subscribe(spy);
    const page = createNotebookPage('Résumé');
    page.text = 'arc';
    component.onResumePageChange(page);
    expect(spy).toHaveBeenCalled();
    expect(spy.calls.mostRecent().args[0].text).toBe('arc');
  });

  it('adds note and checklist pads with free layout', () => {
    const spy = jasmine.createSpy('pads');
    component.padsChange.subscribe((payload) => {
      spy(payload);
      fixture.componentRef.setInput('session', {
        ...baseSession,
        playPads: payload.playPads,
        playNotes: payload.playNotes,
        playNotebook: payload.playNotebook,
      });
      fixture.detectChanges();
    });

    fixture.componentRef.setInput('session', {
      ...baseSession,
      playPads: [createSessionPlayPad('note', 'A', 0)],
      playNotes: '',
    });
    fixture.detectChanges();

    component.addNotePad();
    expect(spy.calls.mostRecent().args[0].playPads.length).toBe(2);
    expect(spy.calls.mostRecent().args[0].playPads[1].layout).toBeTruthy();

    component.addChecklistPad();
    expect(spy.calls.mostRecent().args[0].playPads.length).toBe(3);
    expect(spy.calls.mostRecent().args[0].playPads[2].kind).toBe('checklist');
  });

  it('updates checklist items and title inline', () => {
    const pad = createSessionPlayPad('checklist', 'L', 0);
    fixture.componentRef.setInput('session', { ...baseSession, playPads: [pad], playNotes: '' });
    fixture.detectChanges();

    const spy = jasmine.createSpy('pads');
    component.padsChange.subscribe((payload) => {
      spy(payload);
      fixture.componentRef.setInput('session', {
        ...baseSession,
        playPads: payload.playPads,
        playNotes: payload.playNotes,
        playNotebook: payload.playNotebook,
      });
      fixture.detectChanges();
    });

    component.setPadTitle(pad.id, 'Loot');
    expect(spy.calls.mostRecent().args[0].playPads[0].title).toBe('Loot');

    component.addChecklistItem(pad.id);
    const withItem = spy.calls.mostRecent().args[0].playPads[0];
    const itemId = withItem.items[withItem.items.length - 1].id;
    component.updateChecklistItem(pad.id, itemId, { text: 'Loot', done: true });
    expect(spy.calls.mostRecent().args[0].playPads[0].items.some((i: { text: string }) => i.text === 'Loot')).toBe(
      true,
    );
    component.removeChecklistItem(pad.id, itemId);
    expect(spy.calls.mostRecent().args[0].playPads[0].items.every((i: { id: string }) => i.id !== itemId)).toBe(
      true,
    );
  });

  it('archives pad text', () => {
    const note = createSessionPlayPad('note', 'N', 0);
    note.page = { ...note.page!, text: 'hello' };
    fixture.componentRef.setInput('session', { ...baseSession, playPads: [note] });
    fixture.detectChanges();
    expect(component.archiveText()).toContain('hello');
  });

  it('toggles resume collapsed', () => {
    expect(component.resumeCollapsed()).toBe(false);
    component.toggleResume();
    expect(component.resumeCollapsed()).toBe(true);
  });

  it('toggles board lock for layout editing', () => {
    expect(component.boardLocked()).toBe(true);
    component.toggleBoardLock();
    expect(component.boardLocked()).toBe(false);
    component.toggleBoardLock();
    expect(component.boardLocked()).toBe(true);
  });

  it('opens in-app confirm before removing a pad', () => {
    const a = createSessionPlayPad('note', 'A', 0);
    const b = createSessionPlayPad('note', 'B', 1);
    fixture.componentRef.setInput('session', {
      ...baseSession,
      playPads: [a, b],
      playNotes: '',
    });
    fixture.detectChanges();

    component.requestRemovePad(a.id);
    expect(component.padToRemove()).toBe(a.id);

    const spy = jasmine.createSpy('pads');
    component.padsChange.subscribe(spy);
    component.confirmRemovePad();
    expect(component.padToRemove()).toBeNull();
    expect(spy.calls.mostRecent().args[0].playPads.length).toBe(1);
  });

  it('blocks removing the last pad with a notice', () => {
    const pad = createSessionPlayPad('note', 'Only', 0);
    fixture.componentRef.setInput('session', { ...baseSession, playPads: [pad], playNotes: '' });
    fixture.detectChanges();
    component.requestRemovePad(pad.id);
    expect(component.padToRemove()).toBeNull();
    expect(component.padNotice()).toContain('au moins');
  });
});
