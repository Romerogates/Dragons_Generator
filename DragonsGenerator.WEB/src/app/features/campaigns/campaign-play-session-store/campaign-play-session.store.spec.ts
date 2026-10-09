import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CampaignPlaySessionStore } from './campaign-play-session.store';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { AuthService } from '@core/services/auth.service';
import { CharacterCloudService } from '@core/services/character-cloud.service';
import { NotificationService } from '@core/services/notification.service';
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
  let update: jasmine.Spy;
  let awardXp: jasmine.Spy;
  let proposeCharacter: jasmine.Spy;
  let charList: jasmine.Spy;
  let notificationsRefresh: jasmine.Spy;

  beforeEach(() => {
    postTableChat = jasmine.createSpy('postTableChat').and.returnValue(of({}));
    update = jasmine.createSpy('update').and.returnValue(of({ id: 'c1', updatedAt: '2026-02-01T00:00:00Z' }));
    awardXp = jasmine.createSpy('awardXp').and.returnValue(of({ xpEarnedInCampaign: 10 }));
    proposeCharacter = jasmine.createSpy('proposeCharacter').and.returnValue(of(undefined));
    charList = jasmine.createSpy('list').and.returnValue(of([{ id: 'ch1', name: 'Aria', updatedAt: '' }]));
    notificationsRefresh = jasmine.createSpy('refresh');
    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        provideHttpClient(),
        provideHttpClientTesting(),
        CampaignPlaySessionStore,
        {
          provide: CampaignCloudService,
          useValue: {
            update,
            postTableChat,
            awardXp,
            proposeCharacter,
          },
        },
        {
          provide: AuthService,
          useValue: { user: () => ({ id: 'u1', displayName: 'Alice' }) },
        },
        {
          provide: CharacterCloudService,
          useValue: { list: charList },
        },
        {
          provide: NotificationService,
          useValue: { refresh: notificationsRefresh },
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

  it('saveData PUT strip le fil de table et ne réapplique pas le blob', async () => {
    const c = campaign('dm');
    c.data.sessions[0].tableChat = [
      { id: 'm1', at: '2026-01-01T20:00:00Z', authorUserId: 'u1', authorName: 'Alice', body: 'hi' },
    ];
    store.bindCampaign(c);
    store.saveData({ partyLevel: 7 });
    await new Promise((r) => setTimeout(r, 0));
    expect(update).toHaveBeenCalled();
    const payload = update.calls.mostRecent().args[2] as { sessions: { tableChat?: unknown }[]; partyLevel: number };
    expect(payload.partyLevel).toBe(7);
    expect(payload.sessions[0].tableChat).toBeUndefined();
    expect(store.campaign()?.data.partyLevel).toBe(7);
    expect(store.campaign()?.data.sessions[0].tableChat?.length).toBe(1);
    expect(store.campaign()?.updatedAt).toBe('2026-02-01T00:00:00Z');
  });

  it('updateSession est no-op pour un spectateur', () => {
    store.bindCampaign(campaign('spectator'));
    store.updateSession('s1', { notes: 'nope' }, { immediate: true });
    expect(update).not.toHaveBeenCalled();
  });

  it('patchCombat immédiat envoie un PUT', async () => {
    store.bindCampaign(campaign('dm'));
    const combat = store.activeCombat()!;
    store.patchCombat({ ...combat, round: 2 }, { immediate: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(update).toHaveBeenCalled();
    expect(store.activeCombat()?.round).toBe(2);
  });

  it('applyDmCombatHit persiste PV + journal en une écriture', async () => {
    const c = campaign('dm');
    const combat = c.data.sessions[0].activeCombat!;
    combat.combatants = combat.combatants.map((cb) =>
      cb.kind === 'monster' ? { ...cb, currentHp: 10, maxHp: 10 } : cb,
    );
    store.bindCampaign(c);
    const target = store.activeCombat()!.combatants.find((cb) => cb.kind === 'monster')!;
    store.applyDmCombatHit(target.id, 3, 'Héro → Gobelin : 3');
    await new Promise((r) => setTimeout(r, 0));
    expect(update).toHaveBeenCalledTimes(1);
    expect(store.activeCombat()?.combatants.find((cb) => cb.id === target.id)?.currentHp).toBe(7);
    expect(store.activeSession()?.combatLog?.some((line) => line.includes('3'))).toBeTrue();
  });

  it('applyCombatWithEncounterSync persiste combat + rencontres', async () => {
    store.bindCampaign(campaign('dm'));
    const combat = store.activeCombat()!;
    store.applyCombatWithEncounterSync({
      ...combat,
      combatants: combat.combatants.map((cb) => ({ ...cb, defeated: true })),
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(update).toHaveBeenCalled();
    expect(store.activeCombat()?.combatants.every((cb) => cb.defeated)).toBeTrue();
  });

  it('startPlaySession pose activeSessionId pour le MJ', async () => {
    const c = campaign('dm');
    c.data.activeSessionId = null;
    store.bindCampaign(c);
    store.startPlaySession('s1');
    await new Promise((r) => setTimeout(r, 0));
    expect(store.campaign()?.data.activeSessionId).toBe('s1');
    expect(update).toHaveBeenCalled();
  });

  it('endPlaySession archive et quitte la table', async () => {
    store.bindCampaign(campaign('dm'));
    let ended = '';
    store.endPlaySession('Récap', (id) => {
      ended = id;
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(store.campaign()?.data.activeSessionId).toBeNull();
    expect(store.activeSession()).toBeNull();
    const closed = store.campaign()?.data.sessions.find((s) => s.id === 's1');
    expect(closed?.status).toBe('played');
    expect(closed?.playerRecap).toBe('Récap');
    expect(closed?.activeCombat).toBeNull();
    expect(ended).toBe('c1');
  });

  it('toggleSessionFog persiste la carte active', async () => {
    const c = campaign('dm');
    c.data.sessions[0].activeMapId = 'm1';
    c.data.dungeonMaps = [
      {
        id: 'm1',
        name: 'Crypte',
        theme: 'crypt',
        gridWidth: 4,
        gridHeight: 4,
        tiles: [],
        rooms: [{ id: 'r1', label: 'Salle', x: 0, y: 0, width: 2, height: 2 }],
        markers: [],
        fogOfWarEnabled: false,
        createdAt: '',
        updatedAt: '',
      },
    ];
    store.bindCampaign(c);
    expect(store.toggleSessionFog()).toBeTrue();
    await new Promise((r) => setTimeout(r, 0));
    expect(store.activeSessionMap()?.fogOfWarEnabled).toBeTrue();
    expect(update).toHaveBeenCalled();
  });

  it('toggleSessionFog est no-op sans carte', () => {
    store.bindCampaign(campaign('dm'));
    expect(store.toggleSessionFog()).toBeFalse();
    expect(update).not.toHaveBeenCalled();
  });

  it('startSceneTimer persiste le timer pour le MJ', async () => {
    store.bindCampaign(campaign('dm'));
    store.startSceneTimer(5, 'Scène');
    await new Promise((r) => setTimeout(r, 0));
    const timer = store.activeSession()?.sceneTimer;
    expect(timer?.label).toBe('Scène');
    expect(timer?.pausedRemainingSec).toBeNull();
    expect(update).toHaveBeenCalled();
    store.toggleSceneTimerPause();
    expect(store.activeSession()?.sceneTimer?.pausedRemainingSec).not.toBeNull();
    store.stopSceneTimer();
    expect(store.activeSession()?.sceneTimer).toBeNull();
  });

  it('startSceneTimer est no-op pour un spectateur', () => {
    store.bindCampaign(campaign('spectator'));
    store.startSceneTimer(5);
    expect(update).not.toHaveBeenCalled();
  });

  it('updateCreatureRole et bulk persist les créatures', async () => {
    const c = campaign('dm');
    const gob = {
      creatureId: 'g1',
      creatureName: 'Gobelin',
      category: 'humanoid',
      challengeRating: '1',
      customName: '',
      role: 'neutral' as const,
      backstory: '',
    };
    c.data.creatures = [gob];
    store.bindCampaign(c);
    store.updateCreatureRole(gob, 'ally');
    expect(store.campaign()?.data.creatures[0]?.role).toBe('ally');
    store.applyBulkCreatureRole([gob], 'antagonist');
    await new Promise((r) => setTimeout(r, 0));
    expect(store.campaign()?.data.creatures[0]?.role).toBe('antagonist');
    expect(update).toHaveBeenCalled();
  });

  it('togglePlayerTableReady et assignSessionMap pour le MJ', async () => {
    store.bindCampaign(campaign('dm'));
    expect(store.togglePlayerTableReady('u2')).toBeTrue();
    expect(store.activeSession()?.tableReadyUserIds).toEqual(['u2']);
    store.assignSessionMap('m9');
    await new Promise((r) => setTimeout(r, 0));
    expect(store.activeSession()?.activeMapId).toBe('m9');
    expect(update).toHaveBeenCalled();
  });

  it('togglePlayerTableReady est no-op pour un spectateur', () => {
    store.bindCampaign(campaign('spectator'));
    expect(store.togglePlayerTableReady('u1')).toBeFalse();
    expect(update).not.toHaveBeenCalled();
  });

  it('awardEncounterXp marque xpAwarded', async () => {
    const c = campaign('dm');
    c.members = [
      {
        id: 'm1',
        userId: 'u2',
        displayName: 'Lila',
        role: 'player',
        proposalStatus: 'approved',
        xpEarnedInCampaign: 0,
      },
    ];
    c.data.encounters = [
      {
        id: 'e1',
        name: 'Boss',
        creatures: [
          {
            creatureId: 'x',
            creatureName: 'Orc',
            challengeRating: '1',
            xp: 100,
            quantity: 1,
            defeated: 1,
          },
        ],
      },
    ];
    store.bindCampaign(c);
    store.awardEncounterXp(c.data.encounters[0]!);
    await new Promise((r) => setTimeout(r, 0));
    expect(awardXp).toHaveBeenCalledWith('c1', 'm1', 100);
    expect(store.campaign()?.data.encounters[0]?.xpAwarded).toBeTrue();
    expect(store.feedback()?.kind).toBe('ok');
  });

  it('ouvre les overlays documents / proposer un héros', async () => {
    const c = campaign('dm');
    c.data.pinnedHandoutId = 'h1';
    c.data.handouts = [
      {
        id: 'h1',
        title: 'Carte',
        body: '',
        kind: 'other',
        published: true,
        createdAt: '',
      },
    ];
    store.bindCampaign(c);
    store.openHandoutsOverlay();
    expect(store.playerOverlay()).toBe('handouts');
    expect(store.selectedHandout()?.id).toBe('h1');
    store.openProposeOverlay();
    expect(store.playerOverlay()).toBe('propose');
    expect(store.myCharacters()[0]?.name).toBe('Aria');
    let reloaded = false;
    store.proposeCharacter('ch1', () => {
      reloaded = true;
    });
    expect(proposeCharacter).toHaveBeenCalledWith('c1', 'ch1');
    expect(notificationsRefresh).toHaveBeenCalled();
    expect(reloaded).toBeTrue();
    expect(store.playerOverlay()).toBeNull();
  });

  it('saveData pose le feedback si le PUT échoue', async () => {
    update.and.returnValue(throwError(() => ({ status: 0 })));
    store.bindCampaign(campaign('dm'));
    store.saveData({ partyLevel: 4 });
    await new Promise((r) => setTimeout(r, 0));
    expect(store.feedback()?.kind).toBe('err');
    expect(store.saving()).toBe(false);
  });
});
