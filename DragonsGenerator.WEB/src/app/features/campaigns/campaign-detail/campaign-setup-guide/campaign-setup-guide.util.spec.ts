import {
  buildCampaignSetupGuide,
  type CampaignSetupGuideInput,
} from './campaign-setup-guide.util';

function base(overrides: Partial<CampaignSetupGuideInput> = {}): CampaignSetupGuideInput {
  return {
    hasAdventure: false,
    creatureCount: 0,
    mapCount: 0,
    encounterCount: 0,
    approvedPlayerCount: 0,
    playerCount: 0,
    hasPlannedSession: false,
    hasActiveSession: false,
    nextSessionTitle: null,
    mapsSkipped: false,
    ...overrides,
  };
}

describe('buildCampaignSetupGuide', () => {
  it('starts on scenario when adventure is empty', () => {
    const g = buildCampaignSetupGuide(base());
    expect(g.current?.id).toBe('scenario');
    expect(g.current?.primaryAction).toBe('editScenario');
    expect(g.progressPct).toBe(0);
  });

  it('advances to creatures after scenario', () => {
    const g = buildCampaignSetupGuide(base({ hasAdventure: true }));
    expect(g.current?.id).toBe('creatures');
    expect(g.current?.primaryAction).toBe('openCreatures');
  });

  it('offers skip on maps step', () => {
    const g = buildCampaignSetupGuide(base({ hasAdventure: true, creatureCount: 2 }));
    expect(g.current?.id).toBe('maps');
    expect(g.current?.secondaryAction).toBe('skipMaps');
  });

  it('treats skipped maps as done and moves to encounters', () => {
    const g = buildCampaignSetupGuide(
      base({ hasAdventure: true, creatureCount: 2, mapsSkipped: true }),
    );
    expect(g.steps.find((s) => s.id === 'maps')?.done).toBe(true);
    expect(g.current?.id).toBe('encounters');
    expect(g.current?.primaryAction).toBe('generateEncounters');
  });

  it('shows live session mode when active', () => {
    const g = buildCampaignSetupGuide(base({ hasActiveSession: true, hasAdventure: true }));
    expect(g.liveSession).toBe(true);
    expect(g.current?.primaryAction).toBe('openPlay');
    expect(g.current?.primaryLabel).toBe('Ouvrir la table');
    expect(g.current?.tip).toBe('');
  });

  it('is ready when every step is complete', () => {
    const g = buildCampaignSetupGuide(
      base({
        hasAdventure: true,
        creatureCount: 3,
        mapCount: 1,
        encounterCount: 1,
        approvedPlayerCount: 1,
        playerCount: 1,
        hasPlannedSession: true,
        nextSessionTitle: 'Soirée 1',
      }),
    );
    expect(g.allReady).toBe(true);
    expect(g.current?.primaryAction).toBe('startNextSession');
    expect(g.current?.primaryLabel).toBe('Entrer en session');
    expect(g.current?.title).toBe('Soirée 1');
  });

  it('session step explains prep vs play', () => {
    const g = buildCampaignSetupGuide(
      base({
        hasAdventure: true,
        creatureCount: 1,
        mapsSkipped: true,
        encounterCount: 1,
        approvedPlayerCount: 1,
        playerCount: 1,
      }),
    );
    expect(g.current?.id).toBe('session');
    expect(g.current?.primaryLabel).toBe('Planifier une session');
    expect(g.current?.proposal).toContain('combat');
  });
});
