import { CampaignSessionDockService } from './campaign-session-dock.service';
import type { CampaignDetail } from '@core/models/Campaign/campaign';
import { emptyCampaignData } from '@core/models/Campaign/campaign';

function detail(overrides: Partial<CampaignDetail['data']> = {}): CampaignDetail {
  return {
    id: 'c1',
    title: 'Test',
    isOwner: true,
    role: 'dm',
    members: [],
    updatedAt: new Date().toISOString(),
    data: {
      ...emptyCampaignData(),
      ...overrides,
    },
  };
}

describe('CampaignSessionDockService', () => {
  let dock: CampaignSessionDockService;

  beforeEach(() => {
    dock = new CampaignSessionDockService();
  });

  it('hides when activeSessionId points to a missing session', () => {
    dock.bindCampaign(
      detail({
        activeSessionId: 'gone',
        sessions: [],
      }),
    );
    expect(dock.isVisible()).toBe(false);
    expect(dock.campaignId()).toBeNull();
  });

  it('shows when active session exists', () => {
    dock.bindCampaign(
      detail({
        activeSessionId: 's1',
        sessions: [
          {
            id: 's1',
            title: 'Soirée',
            scheduledAt: new Date().toISOString(),
            status: 'planned',
            mode: 'online',
          },
        ],
      }),
    );
    expect(dock.isVisible()).toBe(true);
    expect(dock.sessionTitle()).toBe('Soirée');
  });

  it('clears when activeSessionId becomes null', () => {
    dock.bindCampaign(
      detail({
        activeSessionId: 's1',
        sessions: [
          {
            id: 's1',
            title: 'Soirée',
            scheduledAt: new Date().toISOString(),
            status: 'planned',
            mode: 'online',
          },
        ],
      }),
    );
    dock.bindCampaign(detail({ activeSessionId: null, sessions: [] }));
    expect(dock.isVisible()).toBe(false);
    // Id mémorisé pour Codex → rencontre même sans session live.
    expect(dock.rememberedCampaignId()).toBe('c1');
  });

  it('remembers campaign id without active session (Codex prep)', () => {
    sessionStorage.clear();
    dock.bindCampaign(detail({ activeSessionId: null, sessions: [] }));
    expect(dock.isVisible()).toBe(false);
    expect(dock.campaignId()).toBeNull();
    expect(sessionStorage.getItem('dg-active-table-campaign')).toBe('c1');
    expect(dock.rememberedCampaignId()).toBe('c1');
  });

  it('forgets sessionStorage on Terminer even without live campaignId', () => {
    sessionStorage.clear();
    dock.bindCampaign(
      detail({
        activeSessionId: 's1',
        sessions: [
          {
            id: 's1',
            title: 'Soirée',
            scheduledAt: new Date().toISOString(),
            status: 'planned',
            mode: 'online',
          },
        ],
      }),
    );
    expect(sessionStorage.getItem('dg-active-table-campaign')).toBe('c1');

    dock.forgetAfterSessionEnd('c1');
    expect(sessionStorage.getItem('dg-active-table-campaign')).toBeNull();
    expect(dock.rememberedCampaignId()).toBeNull();

    // Re-bind sans session après Terminer : ne pas réécrire le storage.
    dock.bindCampaign(detail({ activeSessionId: null, sessions: [] }));
    expect(sessionStorage.getItem('dg-active-table-campaign')).toBeNull();
  });
});
