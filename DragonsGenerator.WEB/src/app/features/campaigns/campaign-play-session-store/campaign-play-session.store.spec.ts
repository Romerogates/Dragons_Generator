import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CampaignPlaySessionStore } from './campaign-play-session.store';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { AuthService } from '@core/services/auth.service';
import {
  createActiveCombat,
  createCombatant,
  resolveCombatFlowPhase,
} from '@core/utils/combat-tracker.util';
import type { CampaignDetail } from '@core/models/Campaign/campaign';
import { emptyCampaignData } from '@core/models/Campaign/campaign';

function campaign(role: CampaignDetail['role'] = 'dm'): CampaignDetail {
  const combat = createActiveCombat(
    [
      createCombatant({ name: 'Héro', kind: 'player', initiativeRoll: 12 }),
      createCombatant({ name: 'Gobelin', kind: 'monster', initiativeRoll: 8 }),
    ],
    { flowPhase: 'fight' },
  );
  return {
    id: 'c1',
    title: 'Table',
    role,
    isOwner: role === 'dm',
    updatedAt: '2026-01-01T00:00:00Z',
    members: [],
    data: {
      ...emptyCampaignData(),
      activeSessionId: 's1',
      sessions: [
        {
          id: 's1',
          title: 'Soirée',
          scheduledAt: '2026-01-01T20:00:00Z',
          status: 'planned',
          activeCombat: combat,
          tableChat: [],
        },
      ],
    },
  };
}

describe('CampaignPlaySessionStore — flowPhase + spectator lock', () => {
  let store: CampaignPlaySessionStore;
  let postTableChat: jasmine.Spy;

  beforeEach(() => {
    postTableChat = jasmine.createSpy('postTableChat').and.returnValue(of({}));
    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        provideHttpClient(),
        provideHttpClientTesting(),
        CampaignPlaySessionStore,
        {
          provide: CampaignCloudService,
          useValue: {
            update: () => of({ id: 'c1', updatedAt: '2026-01-01T00:00:00Z' }),
            postTableChat,
          },
        },
        {
          provide: AuthService,
          useValue: { user: () => ({ id: 'u1', displayName: 'Alice' }) },
        },
      ],
    });
    store = TestBed.inject(CampaignPlaySessionStore);
  });

  afterEach(() => {
    store?.destroy();
  });

  it('exposes fight flowPhase from bound combat', () => {
    store.bindCampaign(campaign('dm'));
    expect(store.combatFlowPhase()).toBe('fight');
    expect(resolveCombatFlowPhase(store.activeCombat()!)).toBe('fight');
  });

  it('blocks spectator shareDiceRoll (no POST)', () => {
    store.bindCampaign(campaign('spectator'));
    expect(store.isSpectator()).toBe(true);
    store.shareDiceRoll(20, 15, 'test');
    expect(postTableChat).not.toHaveBeenCalled();
  });

  it('allows DM shareDiceRoll', () => {
    store.bindCampaign(campaign('dm'));
    store.shareDiceRoll(20, 11, 'table');
    expect(postTableChat).toHaveBeenCalled();
  });

  it('sets feedback on chat POST failure', () => {
    postTableChat.and.returnValue(throwError(() => ({ status: 0 })));
    store.bindCampaign(campaign('dm'));
    store.shareDiceRoll(20, 4);
    expect(store.feedback()?.kind).toBe('err');
  });
});
