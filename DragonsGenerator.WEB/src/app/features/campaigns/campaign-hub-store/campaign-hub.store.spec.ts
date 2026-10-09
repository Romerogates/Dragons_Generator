import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NEVER, of, throwError } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CampaignHubStore } from './campaign-hub.store';
import { CampaignHubSyncService } from './campaign-hub-sync.service';
import { CampaignHubMembersService } from './campaign-hub-members.service';
import { CampaignHubContentService } from './campaign-hub-content.service';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { CampaignSessionCacheService } from '@core/services/campaign-session-cache.service';
import { CampaignLiveService } from '@core/services/campaign-live.service';
import { CampaignSessionDockService } from '@core/services/campaign-session-dock.service';
import { AuthService } from '@core/services/auth.service';
import { NotificationService } from '@core/services/notification.service';
import { CampaignPregenGeneratorService } from '@core/services/campaign-pregen-generator.service';
import { CharacterCloudService } from '@core/services/character-cloud.service';
import { AiGenerationProgressService } from '@core/services/ai-generation-progress.service';
import {
  emptyCampaignData,
  type CampaignDetail,
  type CampaignMember,
  type CampaignPregen,
  type EncounterGroup,
} from '@core/models/Campaign/campaign';

function campaign(over: Partial<CampaignDetail> = {}): CampaignDetail {
  return {
    id: 'c1',
    title: 'Hub',
    role: 'dm',
    isOwner: true,
    updatedAt: '2026-01-01T00:00:00Z',
    members: [],
    data: emptyCampaignData(),
    ...over,
  };
}

function member(over: Partial<CampaignMember> = {}): CampaignMember {
  return {
    id: 'm1',
    userId: 'u2',
    displayName: 'Lila',
    role: 'player',
    proposalStatus: 'pending',
    proposedCharacterName: 'Aria',
    xpEarnedInCampaign: 0,
    ...over,
  };
}

describe('CampaignHubStore', () => {
  let store: CampaignHubStore;
  let sync: CampaignHubSyncService;
  let members: CampaignHubMembersService;
  let content: CampaignHubContentService;
  let update: jasmine.Spy;
  let awardXp: jasmine.Spy;
  let invitePlayer: jasmine.Spy;
  let cache: jasmine.Spy;
  let getJoinLink: jasmine.Spy;
  let createOrRotateJoinLink: jasmine.Spy;
  let revokeJoinLink: jasmine.Spy;
  let listPendingInvites: jasmine.Spy;
  let approveProposal: jasmine.Spy;
  let rejectProposal: jasmine.Spy;
  let removeMember: jasmine.Spy;
  let requestCharacterPick: jasmine.Spy;
  let setMemberSpectator: jasmine.Spy;
  let proposeCharacter: jasmine.Spy;
  let assignPregen: jasmine.Spy;
  let claimPregen: jasmine.Spy;
  let usePregenAtTable: jasmine.Spy;
  let generateOriginalPlayable: jasmine.Spy;
  let generatePlayableDuplicate: jasmine.Spy;
  let charGet: jasmine.Spy;
  let charSave: jasmine.Spy;
  let campaignGet: jasmine.Spy;
  let listActivity: jasmine.Spy;
  let getInitiativeBoard: jasmine.Spy;
  let notificationsRefresh: jasmine.Spy;
  let liveWatch: jasmine.Spy;
  let setArchived: jasmine.Spy;
  let leaveCampaign: jasmine.Spy;
  let deleteCampaign: jasmine.Spy;
  let setScheduleRsvp: jasmine.Spy;

  beforeEach(() => {
    update = jasmine.createSpy('update').and.returnValue(of({ id: 'c1', updatedAt: '2026-02-01T00:00:00Z' }));
    awardXp = jasmine.createSpy('awardXp').and.returnValue(of({ xpEarnedInCampaign: 10 }));
    invitePlayer = jasmine.createSpy('invitePlayer').and.returnValue(of(undefined));
    getJoinLink = jasmine.createSpy('getJoinLink').and.returnValue(
      of({ token: 'tok', enabled: true, createdAt: '2026-01-01T00:00:00Z' }),
    );
    createOrRotateJoinLink = jasmine.createSpy('createOrRotateJoinLink').and.returnValue(
      of({ token: 'newtok', enabled: true, createdAt: '2026-02-01T00:00:00Z' }),
    );
    revokeJoinLink = jasmine.createSpy('revokeJoinLink').and.returnValue(of(undefined));
    listPendingInvites = jasmine.createSpy('listPendingInvites').and.returnValue(
      of([{ id: 'i1', userId: 'u9', displayName: 'Nox', createdAt: '2026-01-01T00:00:00Z' }]),
    );
    approveProposal = jasmine.createSpy('approveProposal').and.returnValue(of(undefined));
    rejectProposal = jasmine.createSpy('rejectProposal').and.returnValue(of(undefined));
    removeMember = jasmine.createSpy('removeMember').and.returnValue(of(undefined));
    requestCharacterPick = jasmine.createSpy('requestCharacterPick').and.returnValue(of(undefined));
    setMemberSpectator = jasmine.createSpy('setMemberSpectator').and.returnValue(of(undefined));
    proposeCharacter = jasmine.createSpy('proposeCharacter').and.returnValue(of(undefined));
    assignPregen = jasmine.createSpy('assignPregen').and.returnValue(of(undefined));
    claimPregen = jasmine.createSpy('claimPregen').and.returnValue(of({ id: 'ch1', name: 'Aria' }));
    usePregenAtTable = jasmine.createSpy('usePregenAtTable').and.returnValue(of(undefined));
    generateOriginalPlayable = jasmine.createSpy('generateOriginalPlayable').and.resolveTo({
      characterId: 'pg1',
      characterName: 'Nyra',
      speciesLabel: 'Elfe',
      classLabel: 'Magicien',
      publicHook: 'Un secret',
      dmBackstory: 'Histoire',
    });
    generatePlayableDuplicate = jasmine.createSpy('generatePlayableDuplicate').and.resolveTo({
      characterId: 'pg2',
      characterName: 'Clone',
      speciesLabel: 'Nain',
      classLabel: 'Guerrier',
      publicHook: '',
      dmBackstory: '',
    });
    charGet = jasmine.createSpy('get').and.returnValue(
      of({
        data: {
          id: 'ch1',
          name: 'Thorn',
          species: { label: 'Humain' },
          classes: [{ classLabel: 'Rôdeur' }],
          personality: { story: 'Un voyageur. Fin.' },
        },
      }),
    );
    charSave = jasmine.createSpy('save').and.returnValue(of(undefined));
    campaignGet = jasmine.createSpy('get').and.returnValue(of(campaign()));
    listActivity = jasmine.createSpy('listActivity').and.returnValue(
      of([{ id: 'a1', actorUserId: 'u1', actorDisplayName: 'MJ', kind: 'note', payloadJson: '{}', createdAt: '2026-01-01T00:00:00Z' }]),
    );
    getInitiativeBoard = jasmine.createSpy('getInitiativeBoard').and.returnValue(of(null));
    notificationsRefresh = jasmine.createSpy('refresh');
    liveWatch = jasmine.createSpy('watch').and.resolveTo(undefined);
    setArchived = jasmine.createSpy('setArchived').and.returnValue(of(undefined));
    leaveCampaign = jasmine.createSpy('leaveCampaign').and.returnValue(of(undefined));
    deleteCampaign = jasmine.createSpy('delete').and.returnValue(of(undefined));
    setScheduleRsvp = jasmine.createSpy('setScheduleRsvp').and.returnValue(
      of([{ userId: 'u2', displayName: 'Lila', status: 'yes', at: '2026-01-01T00:00:00Z' }]),
    );
    cache = jasmine.createSpy('cache');
    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        provideHttpClient(),
        provideHttpClientTesting(),
        CampaignHubStore,
        CampaignHubSyncService,
        CampaignHubMembersService,
        CampaignHubContentService,
        {
          provide: CampaignCloudService,
          useValue: {
            update,
            awardXp,
            invitePlayer,
            getJoinLink,
            createOrRotateJoinLink,
            revokeJoinLink,
            listPendingInvites,
            approveProposal,
            rejectProposal,
            removeMember,
            requestCharacterPick,
            setMemberSpectator,
            proposeCharacter,
            assignPregen,
            claimPregen,
            usePregenAtTable,
            get: campaignGet,
            listActivity,
            getInitiativeBoard,
            setArchived,
            leaveCampaign,
            delete: deleteCampaign,
            setScheduleRsvp,
          },
        },
        {
          provide: CampaignSessionCacheService,
          useValue: { cache, read: () => null },
        },
        {
          provide: CampaignLiveService,
          useValue: {
            connected: () => false,
            watch: liveWatch,
            unwatch: () => Promise.resolve(),
            updates: () => NEVER,
            fallbackPollMs: () => 8_000,
          },
        },
        {
          provide: CampaignSessionDockService,
          useValue: { patchLiveCampaign: () => undefined },
        },
        {
          provide: AuthService,
          useValue: { user: () => ({ id: 'u1' }), isLoggedIn: () => true },
        },
        {
          provide: NotificationService,
          useValue: { refresh: notificationsRefresh },
        },
        {
          provide: CampaignPregenGeneratorService,
          useValue: { generateOriginalPlayable, generatePlayableDuplicate },
        },
        {
          provide: CharacterCloudService,
          useValue: { get: charGet, save: charSave },
        },
        {
          provide: AiGenerationProgressService,
          useValue: { active: () => false, busyMessage: () => 'IA occupée' },
        },
      ],
    });
    store = TestBed.inject(CampaignHubStore);
    sync = TestBed.inject(CampaignHubSyncService);
    members = TestBed.inject(CampaignHubMembersService);
    content = TestBed.inject(CampaignHubContentService);
    store.configure({ isSupportInspect: () => false });
  });

  afterEach(() => {
    store?.destroy();
  });

  it('persists data patches and updates updatedAt', async () => {
    store.campaign.set(campaign());
    store.saveData({ notes: 'MJ' });
    await store['persistTail'];
    expect(update).not.toHaveBeenCalled();
    store.saveData({ adventure: 'Un dragon' });
    await store['persistTail'];
    expect(update).toHaveBeenCalled();
    expect(store.campaign()?.updatedAt).toBe('2026-02-01T00:00:00Z');
    expect(store.campaign()?.data.adventure).toBe('Un dragon');
    expect(cache).toHaveBeenCalled();
  });

  it('skips writes in support inspect', () => {
    store.configure({ isSupportInspect: () => true });
    store.campaign.set(campaign());
    store.saveData({ adventure: 'secret' });
    expect(store.campaign()?.data.adventure).toBe('');
    expect(update).not.toHaveBeenCalled();
  });

  it('awards encounter XP then marks xpAwarded', async () => {
    const enc: EncounterGroup = {
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
    };
    store.campaign.set(campaign({ data: { ...emptyCampaignData(), encounters: [enc] } }));
    content.awardEncounterXp(enc, [{ id: 'm1' }, { id: 'm2' }]);
    expect(awardXp).toHaveBeenCalledTimes(2);
    await store['persistTail'];
    expect(store.campaign()?.data.encounters[0]?.xpAwarded).toBeTrue();
    expect(store.awardingXpId()).toBeNull();
  });

  it('invites a friend and records the pending id', () => {
    store.campaign.set(campaign());
    const ok = jasmine.createSpy('ok');
    members.inviteFriend('u2', 'Lila', { onOk: ok });
    expect(invitePlayer).toHaveBeenCalledWith('c1', 'u2');
    expect(store.pendingInviteUserIds().has('u2')).toBeTrue();
    expect(store.rosterFeedback()).toContain('Lila');
    expect(ok).toHaveBeenCalled();
  });

  it('surfaces invite API errors', () => {
    invitePlayer.and.returnValue(throwError(() => ({ error: { errors: [{ reason: 'Déjà là' }] } })));
    store.campaign.set(campaign());
    const fail = jasmine.createSpy('fail');
    members.inviteFriend('u2', 'Lila', { onFail: fail });
    expect(store.error()).toBe('Déjà là');
    expect(fail).toHaveBeenCalled();
  });

  it('loads join link for the owner only', () => {
    store.campaign.set(campaign({ isOwner: false, role: 'player' }));
    members.loadJoinLink();
    expect(getJoinLink).not.toHaveBeenCalled();
    expect(store.joinLink()).toBeNull();

    store.campaign.set(campaign());
    members.loadJoinLink();
    expect(getJoinLink).toHaveBeenCalledWith('c1');
    expect(store.joinLink()?.token).toBe('tok');
  });

  it('reuses an existing join token without rotating', () => {
    store.campaign.set(campaign());
    store.joinLink.set({ token: 'keep', enabled: true });
    const onToken = jasmine.createSpy('onToken');
    members.ensureJoinLinkToken(onToken);
    expect(createOrRotateJoinLink).not.toHaveBeenCalled();
    expect(onToken).toHaveBeenCalledWith('keep');
  });

  it('creates a join link when missing then delivers the token', () => {
    store.campaign.set(campaign());
    const onToken = jasmine.createSpy('onToken');
    members.ensureJoinLinkToken(onToken);
    expect(createOrRotateJoinLink).toHaveBeenCalledWith('c1');
    expect(store.joinLink()?.token).toBe('newtok');
    expect(onToken).toHaveBeenCalledWith('newtok');
    expect(store.joinLinkBusy()).toBeFalse();
  });

  it('revokes the join link', () => {
    store.campaign.set(campaign());
    store.joinLink.set({ token: 'tok', enabled: true });
    members.revokeJoinLink();
    expect(revokeJoinLink).toHaveBeenCalledWith('c1');
    expect(store.joinLink()).toEqual({ token: null, enabled: false });
    expect(store.rosterFeedback()).toContain('désactivé');
  });

  it('loads pending invites into the pending id set', () => {
    store.campaign.set(campaign());
    members.loadPendingInvites();
    expect(listPendingInvites).toHaveBeenCalledWith('c1');
    expect(store.pendingInviteUserIds().has('u9')).toBeTrue();
  });

  it('approves a member and reports roster feedback', () => {
    store.campaign.set(campaign());
    const ok = jasmine.createSpy('ok');
    members.approveMember(member(), { onOk: ok });
    expect(approveProposal).toHaveBeenCalledWith('c1', 'm1');
    expect(store.rosterFeedback()).toContain('Aria');
    expect(ok).toHaveBeenCalled();
  });

  it('rejects, removes, and sets spectator via roster APIs', () => {
    store.campaign.set(campaign());
    const m = member();
    members.rejectMember(m);
    members.removeMember(m);
    members.setMemberSpectator(m);
    expect(rejectProposal).toHaveBeenCalledWith('c1', 'm1');
    expect(removeMember).toHaveBeenCalledWith('c1', 'm1');
    expect(setMemberSpectator).toHaveBeenCalledWith('c1', 'm1');
    expect(store.rosterFeedback()).toContain('spectateur');
  });

  it('proposes a character and calls onOk', () => {
    store.campaign.set(campaign());
    const ok = jasmine.createSpy('ok');
    members.proposeCharacter('ch1', { onOk: ok });
    expect(proposeCharacter).toHaveBeenCalledWith('c1', 'ch1');
    expect(ok).toHaveBeenCalled();
  });

  it('requests a character pick and clears the loading id', () => {
    store.campaign.set(campaign());
    members.requestCharacterPick(member());
    expect(requestCharacterPick).toHaveBeenCalledWith('c1', 'm1');
    expect(store.characterRequestLoadingId()).toBeNull();
    expect(store.rosterFeedback()).toContain('Lila');
  });

  it('appends a generated pregen then persists', async () => {
    store.campaign.set(campaign());
    await content.generateAutoPregen();
    expect(generateOriginalPlayable).toHaveBeenCalled();
    const pool = store.campaign()?.data.pregenCharacters ?? [];
    expect(pool.length).toBe(1);
    expect(pool[0]?.characterName).toBe('Nyra');
    expect(pool[0]?.status).toBe('ready');
    await store['persistTail'];
    expect(update).toHaveBeenCalled();
  });

  it('blocks auto-pregen when the cap is reached', async () => {
    const filled = Array.from({ length: 10 }, (_, i) => ({
      id: `p${i}`,
      characterId: `c${i}`,
      characterName: `H${i}`,
      speciesLabel: '—',
      classLabel: '—',
      publicHook: '',
      dmBackstory: '',
      dmSecrets: '',
      status: 'ready' as const,
    }));
    store.campaign.set(campaign({ data: { ...emptyCampaignData(), pregenCharacters: filled } }));
    await content.generateAutoPregen();
    expect(generateOriginalPlayable).not.toHaveBeenCalled();
    expect(store.pregenFeedback()).toContain('Plafond atteint');
  });

  it('imports a playable duplicate into the pool', async () => {
    store.campaign.set(campaign());
    await content.importPregenFromCharacter('src1');
    expect(generatePlayableDuplicate).toHaveBeenCalledWith(jasmine.anything(), 'src1', false);
    expect(store.campaign()?.data.pregenCharacters[0]?.characterName).toBe('Clone');
  });

  it('attaches an existing hero without cloning', async () => {
    store.campaign.set(campaign());
    const show = jasmine.createSpy('show');
    await content.attachCharacterAsPregen('ch1', { onShowPregens: show });
    expect(charGet).toHaveBeenCalledWith('ch1');
    expect(charSave).toHaveBeenCalled();
    expect(store.campaign()?.data.pregenCharacters[0]?.characterName).toBe('Thorn');
    expect(store.pregenFeedback()).toContain('Thorn');
    expect(show).toHaveBeenCalled();
  });

  it('removes a pregen with undo restoring the pool', async () => {
    const entry: CampaignPregen = {
      id: 'p1',
      characterId: 'c1',
      characterName: 'Nyra',
      speciesLabel: 'Elfe',
      classLabel: 'Magicien',
      publicHook: '',
      dmBackstory: '',
      dmSecrets: '',
      status: 'ready',
    };
    store.campaign.set(campaign({ data: { ...emptyCampaignData(), pregenCharacters: [entry] } }));
    content.removePregenConfirmed('p1');
    expect(store.campaign()?.data.pregenCharacters).toEqual([]);
    expect(store.pregenUndoAvailable()).toBeTrue();
    content.runPregenUndo();
    expect(store.campaign()?.data.pregenCharacters[0]?.id).toBe('p1');
    expect(store.pregenFeedback()).toBe('Pré-tiré restauré.');
  });

  it('assigns, claims, and uses a pregen at the table', () => {
    const entry: CampaignPregen = {
      id: 'p1',
      characterId: 'c1',
      characterName: 'Nyra',
      speciesLabel: 'Elfe',
      classLabel: 'Magicien',
      publicHook: '',
      dmBackstory: '',
      dmSecrets: '',
      status: 'ready',
    };
    store.campaign.set(campaign());
    const ok = jasmine.createSpy('ok');
    content.assignPregen(entry, member(), { onOk: ok });
    expect(assignPregen).toHaveBeenCalledWith('c1', 'p1', 'u2', 'Lila');
    expect(ok).toHaveBeenCalled();
    content.claimPregen('p1', { onOk: ok });
    expect(claimPregen).toHaveBeenCalledWith('c1', 'p1');
    expect(store.pregenFeedback()).toContain('Mes héros');
    content.usePregenAtTable('p1');
    expect(usePregenAtTable).toHaveBeenCalledWith('c1', 'p1');
    expect(store.pregenFeedback()).toContain('sans copie');
  });

  it('reloads the campaign, caches it, and binds live', () => {
    const loaded = jasmine.createSpy('loaded');
    store.configure({
      isSupportInspect: () => false,
      isOverviewTab: () => true,
      onCampaignLoaded: loaded,
    });
    sync.reload('c1');
    expect(campaignGet).toHaveBeenCalledWith('c1');
    expect(store.campaign()?.title).toBe('Hub');
    expect(store.loading()).toBeFalse();
    expect(cache).toHaveBeenCalled();
    expect(notificationsRefresh).toHaveBeenCalled();
    expect(liveWatch).toHaveBeenCalledWith('c1');
    expect(listActivity).toHaveBeenCalledWith('c1');
    expect(loaded).toHaveBeenCalled();
  });

  it('loads activity into the feed', () => {
    store.campaign.set(campaign());
    sync.loadActivity();
    expect(listActivity).toHaveBeenCalledWith('c1');
    expect(store.activity().length).toBe(1);
    expect(store.activityLoading()).toBeFalse();
  });

  it('soft-reloads a player campaign fully', () => {
    const remote = campaign({
      isOwner: false,
      role: 'player',
      title: 'Live',
      members: [member({ xpEarnedInCampaign: 40, userId: 'u1' })],
    });
    campaignGet.and.returnValue(of(remote));
    store.campaign.set(
      campaign({
        isOwner: false,
        role: 'player',
        members: [member({ xpEarnedInCampaign: 10, userId: 'u1' })],
      }),
    );
    store.loading.set(false);
    sync.softReload();
    expect(campaignGet).toHaveBeenCalledWith('c1');
    expect(store.campaign()?.title).toBe('Live');
    expect(store.syncNotice()).toContain('+30 XP');
  });

  it('updateSession immédiat PUT les sessions', async () => {
    store.campaign.set(
      campaign({
        data: {
          ...emptyCampaignData(),
          sessions: [{ id: 's1', title: 'Soir', scheduledAt: '2026-01-01T20:00:00Z', status: 'planned' }],
        },
      }),
    );
    store.updateSession('s1', { title: 'Nuit' }, { immediate: true });
    await new Promise((r) => setTimeout(r, 0));
    expect(update).toHaveBeenCalled();
    expect(store.campaign()?.data.sessions[0]?.title).toBe('Nuit');
  });

  it('addBlankSession puis removeSession coupe la table active', async () => {
    store.campaign.set(campaign());
    const created = store.addBlankSession();
    expect(created?.title).toBe('Session 1');
    await new Promise((r) => setTimeout(r, 0));
    store.campaign.update((prev) =>
      prev
        ? { ...prev, data: { ...prev.data, activeSessionId: created!.id } }
        : prev,
    );
    expect(store.removeSession(created!.id)).toBeTrue();
    await new Promise((r) => setTimeout(r, 0));
    expect(store.campaign()?.data.activeSessionId).toBeNull();
  });

  it('updateHandout + pin + delete', async () => {
    store.campaign.set(
      campaign({
        data: {
          ...emptyCampaignData(),
          handouts: [
            {
              id: 'h1',
              title: 'Doc',
              body: '',
              kind: 'other',
              published: false,
              createdAt: '2026-01-01T00:00:00Z',
            },
          ],
        },
      }),
    );
    store.updateHandout('h1', { title: 'Carte' }, { immediate: true });
    store.pinHandout('h1');
    expect(store.campaign()?.data.pinnedHandoutId).toBe('h1');
    store.deleteHandout('h1');
    await new Promise((r) => setTimeout(r, 0));
    expect(store.campaign()?.data.handouts).toEqual([]);
    expect(store.campaign()?.data.pinnedHandoutId).toBeNull();
  });

  it('applies a stale remote snapshot', () => {
    store.configure({ isSupportInspect: () => false, isOverviewTab: () => true });
    store.campaign.set(campaign());
    store.staleRemote.set(campaign({ title: 'Autre onglet' }));
    sync.applyStaleRemote();
    expect(store.campaign()?.title).toBe('Autre onglet');
    expect(store.staleRemote()).toBeNull();
    expect(store.syncNotice()).toContain('rechargée');
    expect(listActivity).toHaveBeenCalled();
  });

  it('updates creature role and card then bulk classify', async () => {
    const gob = {
      creatureId: 'g1',
      creatureName: 'Gobelin',
      category: 'humanoid',
      challengeRating: '1',
      customName: 'Grik',
      role: 'neutral' as const,
      backstory: '',
    };
    store.campaign.set(
      campaign({
        data: { ...emptyCampaignData(), creatures: [gob] },
      }),
    );
    content.updateCreatureRole(gob, 'ally');
    expect(store.campaign()?.data.creatures[0]?.role).toBe('ally');
    content.updateCreatureCardField(gob, 'secret', '  un pacte  ');
    expect(store.campaign()?.data.creatures[0]?.secret).toBe('un pacte');
    content.applyBulkCreatureRole([{ ...gob, role: 'neutral' }], 'antagonist');
    await new Promise((r) => setTimeout(r, 0));
    expect(store.campaign()?.data.creatures[0]?.role).toBe('antagonist');
    expect(update).toHaveBeenCalled();
  });

  it('archives, leaves and deletes through the cloud', () => {
    store.campaign.set(campaign());
    members.setArchived(true);
    expect(setArchived).toHaveBeenCalledWith('c1', true);
    expect(store.campaign()?.isArchived).toBeTrue();
    expect(store.syncNotice()).toContain('archivée');

    members.setArchived(false);
    expect(store.syncNotice()).toContain('désarchivée');

    let left = false;
    members.leaveCampaign(() => {
      left = true;
    });
    expect(leaveCampaign).not.toHaveBeenCalled();

    store.campaign.set(campaign({ isOwner: false, role: 'player' }));
    members.leaveCampaign(() => {
      left = true;
    });
    expect(leaveCampaign).toHaveBeenCalledWith('c1');
    expect(left).toBeTrue();

    store.campaign.set(campaign());
    let deleted = false;
    members.deleteCampaign('Wrong', () => {
      deleted = true;
    });
    expect(deleteCampaign).not.toHaveBeenCalled();
    members.deleteCampaign('Hub', () => {
      deleted = true;
    });
    expect(deleteCampaign).toHaveBeenCalledWith('c1');
    expect(deleted).toBeTrue();
  });

  it('patches encounters, RSVP and converts a schedule event to a session', async () => {
    const ev = {
      id: 'ev1',
      title: 'Soir table',
      startsAt: '2026-07-01T20:00:00Z',
      kind: 'game' as const,
      rsvps: [{ userId: 'u9', status: 'yes' as const, at: 't' }],
    };
    store.campaign.set(
      campaign({
        data: {
          ...emptyCampaignData(),
          encounters: [{ id: 'e1', name: 'A', creatures: [] }],
          scheduleEvents: [ev],
        },
      }),
    );
    content.patchEncounter('e1', { name: 'Boss' });
    expect(store.campaign()?.data.encounters[0]?.name).toBe('Boss');
    members.applyScheduleRsvp('ev1', 'yes');
    expect(setScheduleRsvp).toHaveBeenCalledWith('c1', 'ev1', 'yes');
    expect(store.campaign()?.data.scheduleEvents?.[0]?.rsvps?.[0]?.userId).toBe('u2');

    const session = members.convertScheduleEventToSession(ev, ev.startsAt);
    await new Promise((r) => setTimeout(r, 0));
    expect(session?.status).toBe('planned');
    expect(store.campaign()?.data.sessions[0]?.title).toBe('Soir table');
    expect(store.campaign()?.data.scheduleEvents?.[0]?.linkedSessionId).toBe(session?.id);
    expect(invitePlayer).toHaveBeenCalledWith('c1', 'u9');
    expect(store.rosterFeedback()).toContain('invitation');
  });

  it('copies join / friends links and seeds the notebook', async () => {
    store.campaign.set(campaign());
    store.joinLink.set({ token: 'tok', enabled: true });
    const clip = { writeText: jasmine.createSpy('writeText').and.resolveTo(undefined) };
    members.copyJoinLink('http://localhost:8081', clip);
    await new Promise((r) => setTimeout(r, 0));
    expect(clip.writeText).toHaveBeenCalledWith('http://localhost:8081/join/tok');
    expect(store.rosterFeedback()).toContain('invitation');
    members.copyFriendsInviteLink('http://localhost:8081', clip);
    await new Promise((r) => setTimeout(r, 0));
    expect(clip.writeText).toHaveBeenCalledWith('http://localhost:8081/friends');

    store.campaign.set(campaign({ data: { ...emptyCampaignData(), notes: 'Ancien carnet' } }));
    const id = content.ensureNotebookPages(null);
    expect(id).toBe('legacy-notes');
    expect(store.campaign()?.data.notebookPages?.[0]?.text).toBe('Ancien carnet');
    content.persistNotebookPages([
      { id: 'n1', title: 'MJ', mode: 'text', text: 'Hello', inkStrokes: [], updatedAt: '' },
    ]);
    expect(store.campaign()?.data.notes).toBe('Hello');
  });
});
