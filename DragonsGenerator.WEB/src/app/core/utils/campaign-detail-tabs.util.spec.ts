import {
  campaignDetailTabHintFromQuery,
  campaignHubQueryParams,
  campaignHubQueryUnchanged,
  campaignPrepSubTabs,
  clampHubTabsForViewer,
  clampPrepSubForRole,
  isCampaignPrepSub,
  isCampaignPrimaryTab,
  playerPrepTabBlocked,
  resolveCampaignHubDeepLink,
  resolveCampaignPrepSub,
  shouldApplyCampaignDetailRouteQuery,
  visibleCampaignHubTabs,
} from './campaign-detail-tabs.util';

describe('campaign-detail-tabs.util', () => {
  const empty = {
    tab: null,
    sub: null,
    mapId: null,
    sessionId: null,
    eventId: null,
    mapsAction: null,
  };

  it('recognizes primary and prep tabs', () => {
    expect(isCampaignPrimaryTab('players')).toBe(true);
    expect(isCampaignPrimaryTab('calendar')).toBe(true);
    expect(isCampaignPrimaryTab('foo')).toBe(false);
    expect(isCampaignPrepSub('maps')).toBe(true);
    expect(isCampaignPrepSub('players')).toBe(false);
  });

  it('applies notification shortcuts tab=players and tab=calendar', () => {
    expect(shouldApplyCampaignDetailRouteQuery({ ...empty, tab: 'players' })).toBe(true);
    expect(shouldApplyCampaignDetailRouteQuery({ ...empty, tab: 'calendar' })).toBe(true);
    expect(shouldApplyCampaignDetailRouteQuery({ ...empty, tab: 'overview' })).toBe(true);
    expect(shouldApplyCampaignDetailRouteQuery({ ...empty, mapId: 'm' })).toBe(true);
    expect(shouldApplyCampaignDetailRouteQuery({ ...empty, tab: 'prep' })).toBe(true);
    expect(shouldApplyCampaignDetailRouteQuery({ ...empty, tab: 'maps' })).toBe(true);
    expect(shouldApplyCampaignDetailRouteQuery({ ...empty, sub: 'notebook' })).toBe(true);
    expect(shouldApplyCampaignDetailRouteQuery(empty)).toBe(false);
  });

  it('hints tab from session or event when tab is missing', () => {
    expect(campaignDetailTabHintFromQuery({ ...empty, sessionId: 's1' })).toBe('sessions');
    expect(campaignDetailTabHintFromQuery({ ...empty, eventId: 'e1' })).toBe('calendar');
    expect(campaignDetailTabHintFromQuery({ ...empty, tab: 'players' })).toBe('players');
  });

  it('syncs hub query params without redundant navigations', () => {
    expect(campaignHubQueryParams('prep', 'maps')).toEqual({ tab: 'prep', sub: 'maps' });
    expect(campaignHubQueryParams('overview', 'scenario')).toEqual({ tab: 'overview', sub: null });
    const q = new Map<string, string>([['tab', 'prep'], ['sub', 'maps']]);
    expect(
      campaignHubQueryUnchanged({ get: (k) => q.get(k) ?? null }, { tab: 'prep', sub: 'maps' }),
    ).toBeTrue();
    expect(
      campaignHubQueryUnchanged({ get: (k) => q.get(k) ?? null }, { tab: 'sessions', sub: null }),
    ).toBeFalse();
    expect(playerPrepTabBlocked(false, 0)).toBeTrue();
    expect(playerPrepTabBlocked(false, 1)).toBeFalse();
    expect(clampPrepSubForRole('maps', false)).toBe('pregens');
    expect(clampPrepSubForRole('maps', true)).toBe('maps');
  });

  it('resolves prep sub for owner vs player deep-links', () => {
    expect(resolveCampaignPrepSub('prep', true, 'maps')).toBe('maps');
    expect(resolveCampaignPrepSub('prep', true, 'overview' as never)).toBe('scenario');
    expect(resolveCampaignPrepSub('prep', false, 'maps')).toBe('pregens');
    expect(resolveCampaignPrepSub('creatures', false, 'pregens')).toBe('pregens');
    expect(resolveCampaignPrepSub('creatures', true, 'pregens')).toBe('creatures');
  });

  it('lists full prep tabs for the MJ and only pregens for a player', () => {
    expect(campaignPrepSubTabs(true).map((t) => t.id)).toEqual([
      'scenario',
      'creatures',
      'maps',
      'pregens',
      'encounters',
      'notebook',
    ]);
    expect(campaignPrepSubTabs(false).map((t) => t.id)).toEqual(['pregens']);
  });

  it('resolves deep-links to a single intent', () => {
    expect(resolveCampaignHubDeepLink('overview', null, 'm1').kind).toBe('map');
    expect(resolveCampaignHubDeepLink('overview', null, null, 's1').kind).toBe('session');
    expect(resolveCampaignHubDeepLink('overview', null, null, null, 'e1').kind).toBe('event');
    expect(resolveCampaignHubDeepLink('prep', null, null, null, null, 'generate').kind).toBe(
      'mapsAction',
    );
    expect(resolveCampaignHubDeepLink('handouts', 'h1')).toEqual({
      kind: 'primary',
      tab: 'handouts',
      handoutId: 'h1',
    });
    expect(resolveCampaignHubDeepLink('prep', null, null, null, null, null, 'maps')).toEqual({
      kind: 'prep',
      sub: 'maps',
    });
    expect(resolveCampaignHubDeepLink('prep', null, null, null, null, null, 'nope')).toEqual({
      kind: 'prep',
      sub: null,
    });
    expect(resolveCampaignHubDeepLink('activity', null).kind).toBe('activity');
    expect(resolveCampaignHubDeepLink('encounters', null)).toEqual({
      kind: 'legacyPrep',
      sub: 'encounters',
    });
    expect(resolveCampaignHubDeepLink('nope', null).kind).toBe('none');
    expect(resolveCampaignHubDeepLink('prep', null, null, null, null, 'import').kind).toBe(
      'mapsAction',
    );
    expect(resolveCampaignHubDeepLink('players', null)).toEqual({
      kind: 'primary',
      tab: 'players',
      handoutId: null,
    });
    expect(resolveCampaignHubDeepLink('prep', null).kind).toBe('prep');
  });

  it('clamps player tabs and lists visible nav', () => {
    expect(clampHubTabsForViewer(true, 0, 'prep', 'maps')).toEqual({
      tab: 'prep',
      prepSub: 'maps',
    });
    expect(clampHubTabsForViewer(false, 0, 'prep', 'maps')).toEqual({
      tab: 'overview',
      prepSub: 'pregens',
    });
    expect(clampHubTabsForViewer(false, 2, 'prep', 'creatures')).toEqual({
      tab: 'prep',
      prepSub: 'pregens',
    });
    expect(clampHubTabsForViewer(false, 2, 'sessions', 'scenario')).toEqual({
      tab: 'sessions',
      prepSub: 'pregens',
    });
    expect(visibleCampaignHubTabs(true, 0).map((t) => t.id)).toContain('prep');
    expect(visibleCampaignHubTabs(false, 0).map((t) => t.id)).not.toContain('prep');
    expect(visibleCampaignHubTabs(false, 1).map((t) => t.id)).toContain('prep');
  });
});
