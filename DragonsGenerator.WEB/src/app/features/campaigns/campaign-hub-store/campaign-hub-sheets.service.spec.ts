import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CampaignHubSheetsService } from './campaign-hub-sheets.service';
import { CampaignHubStore } from './campaign-hub.store';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { CharacterCloudService } from '@core/services/character-cloud.service';
import { CharacterHandoffService } from '@core/services/character-handoff.service';
import { AuthService } from '@core/services/auth.service';
import {
  emptyCampaignData,
  type CampaignDetail,
  type CampaignMember,
} from '@core/models/Campaign/campaign';

function member(over: Partial<CampaignMember> = {}): CampaignMember {
  return {
    id: 'm1',
    userId: 'u1',
    displayName: 'Alice',
    role: 'player',
    proposalStatus: 'approved',
    approvedCharacterId: 'ch1',
    xpEarnedInCampaign: 0,
    ...over,
  };
}

function campaign(over: Partial<CampaignDetail> = {}): CampaignDetail {
  return {
    id: 'c1',
    title: 'Hub',
    role: 'dm',
    isOwner: true,
    updatedAt: '',
    members: [member()],
    data: emptyCampaignData(),
    ...over,
  };
}

describe('CampaignHubSheetsService', () => {
  let svc: CampaignHubSheetsService;
  const campaignSig = signal<CampaignDetail | null>(campaign());
  const errorSig = signal<string | null>(null);
  const pregenFeedback = signal<string | null>(null);
  let navigate: jasmine.Spy;
  let setCurrent: jasmine.Spy;
  let stashEdit: jasmine.Spy;
  let getMemberCharacter: jasmine.Spy;
  let getPregenCharacter: jasmine.Spy;
  let charGet: jasmine.Spy;

  beforeEach(() => {
    campaignSig.set(campaign());
    errorSig.set(null);
    pregenFeedback.set(null);
    navigate = jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true));
    setCurrent = jasmine.createSpy('setCurrent');
    stashEdit = jasmine.createSpy('stashEdit');
    getMemberCharacter = jasmine
      .createSpy('getMemberCharacter')
      .and.returnValue(of({ data: { level: 2 }, name: 'Aria' }));
    getPregenCharacter = jasmine
      .createSpy('getPregenCharacter')
      .and.returnValue(of({ data: { level: 1 }, name: 'Mira' }));
    charGet = jasmine
      .createSpy('get')
      .and.returnValue(of({ id: 'ch1', name: 'Aria', data: { level: 4 } }));
    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        CampaignHubSheetsService,
        {
          provide: CampaignHubStore,
          useValue: { campaign: campaignSig, error: errorSig, pregenFeedback },
        },
        {
          provide: CampaignCloudService,
          useValue: { getMemberCharacter, getPregenCharacter },
        },
        { provide: CharacterCloudService, useValue: { get: charGet } },
        { provide: CharacterHandoffService, useValue: { setCurrent, stashEdit } },
        { provide: AuthService, useValue: { user: () => ({ id: 'u1' }) } },
        { provide: Router, useValue: { navigate } },
      ],
    });
    svc = TestBed.inject(CampaignHubSheetsService);
  });

  it('viewMemberCharacter ouvre la fiche consult', () => {
    svc.viewMemberCharacter(member(), 'approved');
    expect(setCurrent).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/character-sheet']);
    expect(svc.memberCharacterLoadingId()).toBeNull();
  });

  it('viewMemberCharacter no-op sans campagne', () => {
    campaignSig.set(null);
    svc.viewMemberCharacter(member(), 'approved');
    expect(getMemberCharacter).not.toHaveBeenCalled();
  });

  it('printMemberFullSheet pose l’erreur métier si GET échoue', () => {
    getMemberCharacter.and.returnValue(throwError(() => ({ status: 500 })));
    svc.printMemberFullSheet(member());
    expect(errorSig()).toBe('Impossible de générer la fiche PDF.');
    expect(svc.memberCharacterLoadingId()).toBeNull();
  });

  it('openLevelUpFromXp stash + /create si fiche approuvée', () => {
    svc.openLevelUpFromXp(() => undefined);
    expect(stashEdit).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/create'], { queryParams: { levelUp: '1' } });
  });

  it('openLevelUpFromXp appelle le fallback sans perso', () => {
    campaignSig.set(campaign({ members: [member({ approvedCharacterId: null })] }));
    let called = false;
    svc.openLevelUpFromXp(() => {
      called = true;
    });
    expect(called).toBeTrue();
    expect(charGet).not.toHaveBeenCalled();
  });

  it('viewPregenCharacter joueur charge via campagne', () => {
    campaignSig.set(campaign({ isOwner: false, role: 'player' }));
    svc.viewPregenCharacter({
      id: 'p1',
      characterId: 'ch9',
      characterName: 'Mira',
      publicHook: '',
      dmBackstory: '',
      dmSecrets: '',
      status: 'ready',
    });
    expect(getPregenCharacter).toHaveBeenCalled();
    expect(setCurrent).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/character-sheet']);
  });
});
