import { ComponentFixture, TestBed } from '@angular/core/testing';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CampaignCalendar } from './campaign-calendar';
import { createCampaignScheduleEvent } from '@core/models/Campaign/campaign';

describe('CampaignCalendar', () => {
  let fixture: ComponentFixture<CampaignCalendar>;
  let component: CampaignCalendar;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CampaignCalendar],
      providers: [...zonelessTestProviders],
    }).compileComponents();

    fixture = TestBed.createComponent(CampaignCalendar);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isOwner', true);
    fixture.componentRef.setInput('campaignTitle', 'Test Campagne');
    fixture.componentRef.setInput('sessions', []);
    fixture.componentRef.setInput('scheduleEvents', []);
    fixture.componentRef.setInput('heroOptions', [
      { id: 'hero-1', label: 'Aria (pré-tiré)' },
    ]);
    fixture.detectChanges();
  });

  it('renders calendar root and export button', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="campaign-calendar-root"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="calendar-export-ics"]')).toBeTruthy();
    expect(el.querySelector('[data-testid="calendar-add-date"]')).toBeTruthy();
  });

  it('opens draft panel when adding a blank date', () => {
    component.addBlankDate();
    fixture.detectChanges();
    expect(component.panelOpen()).toBe(true);
    expect(component.draft()?.title).toBeTruthy();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('[data-testid="calendar-event-panel"]')).toBeTruthy();
  });

  it('emits scheduleEventsChange on save', () => {
    const existing = createCampaignScheduleEvent({ id: 'keep', title: 'Keep' });
    fixture.componentRef.setInput('scheduleEvents', [existing]);
    fixture.detectChanges();

    let emitted: unknown;
    component.scheduleEventsChange.subscribe((v) => (emitted = v));

    component.addBlankDate();
    component.patchDraft({ title: 'Nouvelle soirée', kind: 'social' });
    component.saveDraft();

    expect(Array.isArray(emitted)).toBe(true);
    const list = emitted as ReturnType<typeof createCampaignScheduleEvent>[];
    expect(list.some((e) => e.title === 'Nouvelle soirée' && e.kind === 'social')).toBe(true);
    expect(list.some((e) => e.id === 'keep')).toBe(true);
    expect(component.panelOpen()).toBe(false);
  });
});
