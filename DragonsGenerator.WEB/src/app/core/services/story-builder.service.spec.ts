import { TestBed } from '@angular/core/testing';
import { zonelessTestProviders } from '@testing/zoneless-test-providers';
import { StoryBuilderService } from './story-builder.service';
import type { CampaignDetail } from '@core/models/Campaign/campaign';
import { UNKNOWN_REGION_LABEL } from '@core/utils/eana-map';

describe('StoryBuilderService', () => {
  let service: StoryBuilderService;

  const sampleCampaign: CampaignDetail = {
    id: 'camp-1',
    title: 'Les Ombres',
    role: 'dm',
    isOwner: true,
    updatedAt: '2026-01-01T00:00:00Z',
    members: [],
    data: {
      setting: 'taverne',
      regionId: 'civ-cite-franche',
      regionName: 'Cité Franche',
      partyLevel: 5,
      tone: 'dark',
      adventure: 'Synopsis test',
      creatures: [
        {
          creatureId: 'cre-gob',
          creatureName: 'Gobelin',
          category: 'humanoid',
          challengeRating: '1/4',
          customName: 'Skrix',
          role: 'antagonist',
          backstory: 'Vie sombre',
        },
      ],
      encounters: [{ id: 'enc-1', name: 'Combat', creatures: [] }],
      notes: 'Note MJ',
      pregenCharacters: [],
      sessions: [],
    },
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [...zonelessTestProviders, StoryBuilderService],
    });
    service = TestBed.inject(StoryBuilderService);
    service.reset();
  });

  it('loads a campaign for editing and preserves encounters/notes', () => {
    service.loadCampaignIntoBuilder(sampleCampaign);

    expect(service.editingCampaignId()).toBe('camp-1');
    expect(service.title()).toBe('Les Ombres');
    expect(service.region()?.kind).toBe('civilization');
    expect(service.buildCampaignData().encounters).toEqual(sampleCampaign.data.encounters);
    expect(service.buildCampaignData().notes).toBe('Note MJ');
  });

  it('builds unknown region campaign data', () => {
    service.loadCampaignIntoBuilder({
      ...sampleCampaign,
      data: {
        ...sampleCampaign.data,
        regionId: null,
        regionName: UNKNOWN_REGION_LABEL,
      },
    });

    expect(service.region()?.kind).toBe('unknown');
    expect(service.buildCampaignData().regionName).toBe(UNKNOWN_REGION_LABEL);
  });

  it('merges creatures when editing without replacing existing ones', () => {
    service.loadCampaignIntoBuilder(sampleCampaign, 'creatures-only');
    service.mergeCreatures([
      {
        creatureId: 'cre-new',
        creatureName: 'Orc',
        category: 'humanoid',
        challengeRating: '1/2',
        customName: 'Brute',
        role: 'antagonist',
        backstory: '',
      },
    ]);

    const ids = service.creatures().map((c) => c.creatureId);
    expect(ids).toContain('cre-gob');
    expect(ids).toContain('cre-new');
    expect(service.isBaselineCreature('cre-gob')).toBe(true);
    expect(service.isBaselineCreature('cre-new')).toBe(false);
  });

  it('clears edit mode on reset', () => {
    service.loadCampaignIntoBuilder(sampleCampaign);
    service.reset();

    expect(service.editingCampaignId()).toBeNull();
    expect(service.isEditingCampaign()).toBe(false);
  });
});
