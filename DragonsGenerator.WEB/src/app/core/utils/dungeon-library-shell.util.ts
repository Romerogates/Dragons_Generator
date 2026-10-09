/** Coquille campagne minimale pour l’éditeur bibliothèque (+ URL de partage). */

import {
  emptyCampaignData,
  type CampaignData,
  type CampaignDetail,
} from '@core/models/Campaign/campaign';
import type { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';

export function dungeonShareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/$/, '')}/dungeons/shared/${token}`;
}

export function normalizeLibraryDungeonMap(
  id: string,
  name: string,
  raw: CampaignDungeonMap,
): CampaignDungeonMap {
  return {
    ...raw,
    id,
    name: name || raw.name || 'Donjon',
  };
}

export function buildLibraryDungeonShell(
  cloudId: string,
  map: CampaignDungeonMap,
  readOnly: boolean,
  updatedAt = new Date().toISOString(),
): CampaignDetail {
  const data: CampaignData = {
    ...emptyCampaignData(),
    dungeonMaps: [map],
  };
  return {
    id: `library-${cloudId}`,
    title: 'Bibliothèque',
    data,
    role: 'dm',
    isOwner: !readOnly,
    updatedAt,
    members: [],
  };
}
