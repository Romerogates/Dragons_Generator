/** Onglets hub campagne + deep-link `?tab=` / `?sub=` / `?map=` / `?session=` / `?event=`. */

export type CampaignPrimaryTab =
  | 'overview'
  | 'sessions'
  | 'calendar'
  | 'handouts'
  | 'prep'
  | 'players';

export type CampaignPrepSub =
  | 'scenario'
  | 'creatures'
  | 'maps'
  | 'pregens'
  | 'encounters'
  | 'notebook';

export const CAMPAIGN_PREP_SUBS: CampaignPrepSub[] = [
  'scenario',
  'creatures',
  'maps',
  'pregens',
  'encounters',
  'notebook',
];

const PRIMARY_TABS: CampaignPrimaryTab[] = [
  'overview',
  'sessions',
  'calendar',
  'handouts',
  'prep',
  'players',
];

export function isCampaignPrepSub(t: string): t is CampaignPrepSub {
  return (CAMPAIGN_PREP_SUBS as string[]).includes(t);
}

export function isCampaignPrimaryTab(t: string): t is CampaignPrimaryTab {
  return (PRIMARY_TABS as string[]).includes(t);
}

export interface CampaignPrepSubTab {
  id: CampaignPrepSub;
  label: string;
  icon: string;
}

const OWNER_PREP_TABS: CampaignPrepSubTab[] = [
  { id: 'scenario', label: 'Scénario', icon: 'fluent-emoji:scroll' },
  { id: 'creatures', label: 'Créatures', icon: 'fluent-emoji:dragon' },
  { id: 'maps', label: 'Donjons', icon: 'fluent-emoji:world-map' },
  { id: 'pregens', label: 'Pré-tirés', icon: 'fluent-emoji:performing-arts' },
  { id: 'encounters', label: 'Rencontres', icon: 'fluent-emoji:crossed-swords' },
  { id: 'notebook', label: 'Carnet', icon: 'fluent-emoji:memo' },
];

const PLAYER_PREP_TABS: CampaignPrepSubTab[] = [
  { id: 'pregens', label: 'Pré-tirés', icon: 'fluent-emoji:performing-arts' },
];

export function campaignPrepSubTabs(isOwner: boolean): CampaignPrepSubTab[] {
  return isOwner ? OWNER_PREP_TABS : PLAYER_PREP_TABS;
}

/** Deep-link `tab=prep` / sous-onglet : joueur → pré-tirés uniquement. */
export function resolveCampaignPrepSub(
  hint: string,
  isOwner: boolean,
  current: CampaignPrepSub,
): CampaignPrepSub {
  if (hint === 'prep') {
    if (!isOwner) return 'pregens';
    return CAMPAIGN_PREP_SUBS.includes(current) ? current : 'scenario';
  }
  if (!isOwner && hint !== 'pregens') return 'pregens';
  return isCampaignPrepSub(hint) ? hint : 'scenario';
}

export interface CampaignDetailRouteQuery {
  tab: string | null;
  sub: string | null;
  mapId: string | null;
  sessionId: string | null;
  eventId: string | null;
  mapsAction: string | null;
}

/** True si le query doit changer l’onglet (y compris `tab=players` / `calendar`). */
export function shouldApplyCampaignDetailRouteQuery(q: CampaignDetailRouteQuery): boolean {
  if (q.mapId || q.sessionId || q.eventId || q.mapsAction) return true;
  if (q.tab === 'activity' || q.tab === 'prep' || isCampaignPrimaryTab(q.tab ?? '')) return true;
  if (q.tab && isCampaignPrepSub(q.tab)) return true;
  if (q.sub && isCampaignPrepSub(q.sub)) return true;
  return false;
}

export function campaignHubQueryParams(
  tab: CampaignPrimaryTab,
  prepSub: CampaignPrepSub,
): Record<string, string | null> {
  return tab === 'prep' ? { tab: 'prep', sub: prepSub } : { tab, sub: null };
}

export function campaignHubQueryUnchanged(
  current: { get(key: string): string | null },
  next: Record<string, string | null>,
): boolean {
  if (current.get('tab') !== next['tab']) return false;
  return next['sub'] == null ? !current.get('sub') : current.get('sub') === next['sub'];
}

/** Joueur sans pré-tirés : l’onglet Préparation n’a rien à montrer. */
export function playerPrepTabBlocked(isOwner: boolean, pregenCount: number): boolean {
  return !isOwner && pregenCount === 0;
}

export function clampPrepSubForRole(sub: CampaignPrepSub, isOwner: boolean): CampaignPrepSub {
  return !isOwner && sub !== 'pregens' ? 'pregens' : sub;
}

export function campaignDetailTabHintFromQuery(q: CampaignDetailRouteQuery): string {
  if (q.tab) return q.tab;
  if (q.sessionId) return 'sessions';
  if (q.eventId) return 'calendar';
  return 'maps';
}

export type CampaignHubDeepLink =
  | { kind: 'map'; mapId: string }
  | { kind: 'session'; sessionId: string }
  | { kind: 'event'; eventId: string }
  | { kind: 'mapsAction'; action: 'generate' | 'import' }
  | { kind: 'primary'; tab: CampaignPrimaryTab; handoutId: string | null }
  | { kind: 'prep'; sub: CampaignPrepSub | null }
  | { kind: 'activity' }
  | { kind: 'legacyPrep'; sub: CampaignPrepSub }
  | { kind: 'none' };

export function resolveCampaignHubDeepLink(
  tab: string,
  handoutId: string | null,
  mapId: string | null = null,
  sessionId: string | null = null,
  scheduleEventId: string | null = null,
  mapsAction: string | null = null,
  sub: string | null = null,
): CampaignHubDeepLink {
  if (mapId) return { kind: 'map', mapId };
  if (sessionId) return { kind: 'session', sessionId };
  if (scheduleEventId) return { kind: 'event', eventId: scheduleEventId };
  if (mapsAction === 'generate' || mapsAction === 'import') {
    return { kind: 'mapsAction', action: mapsAction };
  }
  if (
    tab === 'handouts' ||
    tab === 'players' ||
    tab === 'overview' ||
    tab === 'sessions' ||
    tab === 'calendar'
  ) {
    return { kind: 'primary', tab, handoutId };
  }
  if (tab === 'prep') {
    if (sub && isCampaignPrepSub(sub)) return { kind: 'prep', sub };
    return { kind: 'prep', sub: null };
  }
  if (tab === 'activity') return { kind: 'activity' };
  if (isCampaignPrepSub(tab)) return { kind: 'legacyPrep', sub: tab };
  return { kind: 'none' };
}

export function clampHubTabsForViewer(
  mjUi: boolean,
  pregenCount: number,
  tab: CampaignPrimaryTab,
  prepSub: CampaignPrepSub,
): { tab: CampaignPrimaryTab; prepSub: CampaignPrepSub } {
  if (mjUi) return { tab, prepSub };
  let nextTab = tab;
  let nextSub = prepSub;
  if (pregenCount === 0 && tab === 'prep') nextTab = 'overview';
  else if (tab === 'prep' && prepSub !== 'pregens') nextSub = 'pregens';
  if (
    nextSub === 'creatures' ||
    nextSub === 'encounters' ||
    nextSub === 'maps' ||
    nextSub === 'notebook' ||
    nextSub === 'scenario'
  ) {
    nextSub = 'pregens';
  }
  return { tab: nextTab, prepSub: nextSub };
}

export type CampaignHubTabDef = { id: CampaignPrimaryTab; label: string; icon: string };

export function visibleCampaignHubTabs(
  isOwner: boolean,
  pregenCount: number,
): CampaignHubTabDef[] {
  const tabs: CampaignHubTabDef[] = [
    { id: 'overview', label: 'Résumé', icon: 'fluent-emoji:clipboard' },
    { id: 'sessions', label: 'Sessions', icon: 'fluent-emoji:calendar' },
    { id: 'calendar', label: 'Calendrier', icon: 'fluent-emoji:spiral-calendar' },
    { id: 'handouts', label: 'Documents', icon: 'fluent-emoji:page-facing-up' },
  ];
  if (isOwner || pregenCount > 0) {
    tabs.push({ id: 'prep', label: 'Préparation', icon: 'fluent-emoji:hammer-and-wrench' });
  }
  tabs.push({ id: 'players', label: 'Joueurs', icon: 'fluent-emoji:busts-in-silhouette' });
  return tabs;
}
