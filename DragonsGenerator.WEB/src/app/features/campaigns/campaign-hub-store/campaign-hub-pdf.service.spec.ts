import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { CampaignHubPdfService } from './campaign-hub-pdf.service';
import { CampaignHubStore } from './campaign-hub.store';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import { DataService } from '@core/services/data.service';
import {
  emptyCampaignData,
  type CampaignDetail,
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

function creatureSel() {
  return {
    creatureId: 'gob',
    creatureName: 'Gobelin',
    category: 'humanoid',
    challengeRating: '1/4',
    customName: 'Grib',
    role: 'antagonist' as const,
    backstory: '',
  };
}

describe('CampaignHubPdfService', () => {
  let svc: CampaignHubPdfService;
  const campaignSig = signal<CampaignDetail | null>(campaign());
  const errorSig = signal<string | null>(null);

  beforeEach(() => {
    campaignSig.set(campaign());
    errorSig.set(null);
    TestBed.configureTestingModule({
      providers: [
        ...zonelessTestProviders,
        CampaignHubPdfService,
        {
          provide: CampaignHubStore,
          useValue: { campaign: campaignSig, error: errorSig },
        },
        {
          provide: DataService,
          useValue: { getCreatureById: () => of(null) },
        },
        {
          provide: CampaignCloudService,
          useValue: { getMemberCharacter: () => of({ data: {}, name: 'Aria' }) },
        },
      ],
    });
    svc = TestBed.inject(CampaignHubPdfService);
  });

  it('printBestiary sans créature pose l’erreur métier', () => {
    svc.printBestiary();
    expect(errorSig()).toBe('Aucune créature à imprimer.');
    expect(svc.printing()).toBe(false);
  });

  it('printAllPlayerSheets sans perso approuvé pose l’erreur métier', () => {
    svc.printAllPlayerSheets();
    expect(errorSig()).toBe('Aucun joueur avec personnage approuvé.');
  });

  it('printAllPlayerSheets sans campagne ne fait rien', () => {
    campaignSig.set(null);
    svc.printAllPlayerSheets();
    expect(errorSig()).toBeNull();
  });

  it('printPackMj sans campagne ne fait rien', () => {
    campaignSig.set(null);
    svc.printPackMj();
    expect(svc.printing()).toBe(false);
  });

  it('exportSessionEveningPdf sans campagne ou session ne fait rien', async () => {
    campaignSig.set(null);
    await svc.exportSessionEveningPdf('s1');
    campaignSig.set(campaign());
    await svc.exportSessionEveningPdf('missing');
    expect(errorSig()).toBeNull();
  });

  it('exportSessionUnifiedPack sans session ne fait rien', async () => {
    await svc.exportSessionUnifiedPack('missing');
    expect(errorSig()).toBeNull();
  });

  it('loadPackPreview hors propriétaire n’ouvre pas le chargement', () => {
    campaignSig.set(campaign({ isOwner: false, role: 'player' }));
    svc.loadPackPreview();
    expect(svc.isLoadingPreview()).toBe(false);
    expect(svc.pdfPreviewUrl()).toBeNull();
  });

  it('loadBestiaryPreview sans créature n’ouvre pas le chargement', () => {
    svc.loadBestiaryPreview();
    expect(svc.isLoadingPreview()).toBe(false);
  });

  it('openBestiaryFullscreen et download sans blob sont no-op', () => {
    expect(() => svc.openBestiaryFullscreen()).not.toThrow();
    expect(() => svc.downloadPdfPreview()).not.toThrow();
  });

  it('loadBestiaryPreview MJ sans entrée créature révoque', async () => {
    campaignSig.set(
      campaign({
        data: { ...emptyCampaignData(), creatures: [creatureSel()] },
      }),
    );
    svc.loadBestiaryPreview();
    await new Promise((r) => setTimeout(r, 20));
    expect(svc.pdfPreviewUrl()).toBeNull();
    expect(svc.isLoadingPreview()).toBe(false);
  });

  it('destroy révoque l’aperçu', () => {
    expect(() => svc.destroy()).not.toThrow();
    expect(svc.pdfPreviewUrl()).toBeNull();
  });
});
