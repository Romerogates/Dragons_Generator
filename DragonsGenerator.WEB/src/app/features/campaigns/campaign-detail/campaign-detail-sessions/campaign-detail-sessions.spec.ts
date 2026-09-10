import { ComponentFixture, TestBed } from '@angular/core/testing';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CampaignDetailSessions } from './campaign-detail-sessions';
import type { CampaignSession } from '@core/models/Campaign/campaign';

function session(partial: Partial<CampaignSession>): CampaignSession {
  return {
    id: 's1',
    title: 'Session test',
    scheduledAt: new Date().toISOString(),
    status: 'planned',
    mode: 'online',
    ...partial,
  };
}

describe('CampaignDetailSessions read-only archive', () => {
  let component: CampaignDetailSessions;
  let fixture: ComponentFixture<CampaignDetailSessions>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CampaignDetailSessions],
      providers: [...zonelessTestProviders],
    }).compileComponents();

    fixture = TestBed.createComponent(CampaignDetailSessions);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('isOwner', true);
    fixture.componentRef.setInput('sortedSessions', []);
    fixture.componentRef.setInput('upcomingSessions', []);
    fixture.componentRef.setInput('pastSessions', [
      session({ id: 'played-1', status: 'played', notes: '--- Notes de session ---\nOK' }),
    ]);
    fixture.componentRef.setInput('editingSessionId', null);
    fixture.componentRef.setInput('hasActiveSession', false);
    fixture.componentRef.setInput('activeSessionId', null);
    fixture.detectChanges();
  });

  it('allows archive view only for played or cancelled', () => {
    expect(component.canViewArchive(session({ status: 'played' }))).toBe(true);
    expect(component.canViewArchive(session({ status: 'cancelled' }))).toBe(true);
    expect(component.canViewArchive(session({ status: 'planned' }))).toBe(false);
  });

  it('lets players open archive only when playerRecap is set', () => {
    fixture.componentRef.setInput('isOwner', false);
    fixture.detectChanges();
    expect(component.canViewArchive(session({ status: 'played' }))).toBe(false);
    expect(
      component.canViewArchive(session({ status: 'played', playerRecap: 'Victoire' })),
    ).toBe(true);
    expect(component.canViewArchive(session({ status: 'planned', playerRecap: 'x' }))).toBe(false);
  });

  it('opens and closes the read-only panel', () => {
    component.openViewSession('played-1');
    expect(component.viewingSessionId()).toBe('played-1');
    expect(component.viewingSession()?.notes).toContain('Notes de session');
    component.closeViewSession();
    expect(component.viewingSession()).toBeNull();
  });
});
