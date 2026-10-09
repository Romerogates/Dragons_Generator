import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { NotificationService } from '@core/services/notification.service';
import { emptyCampaignData, type CampaignDetail, type CampaignMember } from '@core/models/Campaign/campaign';
import { CampaignHubRosterService } from './campaign-hub-roster.service';
import { CampaignHubStore } from './campaign-hub.store';
import { CampaignHubMembersService } from './campaign-hub-members.service';
import { CampaignHubSyncService } from './campaign-hub-sync.service';
import { CampaignHubNavService } from './campaign-hub-nav.service';
import { CampaignHubSheetsService } from './campaign-hub-sheets.service';
import { CampaignHubBootService } from './campaign-hub-boot.service';

describe('CampaignHubRosterService', () => {
  let svc: CampaignHubRosterService;
  const campaign = signal<CampaignDetail | null>({
    id: 'c1',
    title: 'Hub',
    role: 'dm',
    isOwner: true,
    updatedAt: '',
    members: [],
    data: emptyCampaignData(),
  });
  let askConfirm: jasmine.Spy;

  beforeEach(() => {
    askConfirm = jasmine.createSpy('askConfirm');
    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        CampaignHubRosterService,
        {
          provide: CampaignHubStore,
          useValue: {
            campaign,
            leaving: signal(false),
            archiving: signal(false),
            deletingCampaign: signal(false),
            deleteCampaignError: signal(null),
            joinLinkBusy: () => false,
            characterRequestLoadingId: () => null,
          },
        },
        {
          provide: CampaignHubMembersService,
          useValue: {
            rotateJoinLink: () => undefined,
            revokeJoinLink: () => undefined,
            inviteFriend: jasmine.createSpy('inviteFriend'),
            loadPendingInvites: () => undefined,
            rejectMember: () => undefined,
          },
        },
        { provide: CampaignHubSyncService, useValue: { loadActivity: () => undefined } },
        { provide: CampaignHubNavService, useValue: { tab: () => 'overview', setTab: () => undefined } },
        { provide: CampaignHubSheetsService, useValue: { openLevelUpFromXp: jasmine.createSpy('openLevelUpFromXp') } },
        { provide: CampaignHubBootService, useValue: { askConfirm, reload: () => undefined, friendsList: signal([]) } },
        { provide: NotificationService, useValue: { refresh: () => undefined } },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
      ],
    });
    svc = TestBed.inject(CampaignHubRosterService);
  });

  it('demande confirmation pour régénérer le lien', () => {
    svc.regenerateJoinLink();
    expect(askConfirm).toHaveBeenCalled();
  });

  it('refuse une proposition via confirm', () => {
    const member = {
      id: 'm1',
      userId: 'u1',
      displayName: 'Alice',
      role: 'player',
      proposalStatus: 'pending',
      proposedCharacterName: 'Mira',
      xpEarnedInCampaign: 0,
    } as CampaignMember;
    svc.rejectMember(member);
    expect(askConfirm.calls.mostRecent().args[0]).toContain('Refuser');
  });

  it('inviteFriend envoie le nom ami si la liste est vide', () => {
    const members = TestBed.inject(CampaignHubMembersService) as unknown as { inviteFriend: jasmine.Spy };
    svc.inviteFriend('u9');
    expect(members.inviteFriend).toHaveBeenCalledWith('u9', 'ami', jasmine.any(Object));
  });
});
