import type { Character } from '@core/models/Character/character';
import type {
  CampaignDetail,
  CampaignMember,
  CampaignPregen,
} from '@core/models/Campaign/campaign';

export function characterFromNamedPayload(res: {
  data: unknown;
  name?: string;
}): Character {
  const character = { ...(typeof res.data === 'object' && res.data ? res.data : {}) } as Character;
  if (res.name) character.name = res.name;
  return character;
}

export function characterFromOwnedCloudRow(row: {
  id: string;
  name: string;
  data: unknown;
}): Character {
  return {
    id: row.id,
    name: row.name,
    ...(typeof row.data === 'object' && row.data ? row.data : {}),
  } as Character;
}

export function assignedPregensForUser(
  pregens: CampaignPregen[] | undefined,
  userId: string | null | undefined,
): CampaignPregen[] {
  if (!userId) return [];
  return (pregens ?? []).filter(
    (p) => p.assignedUserId === userId && (p.status === 'assigned' || p.status === 'claimed'),
  );
}

/**
 * Pré-tirés prêts côté joueur. Une seule voie : fiche proposée/approuvée XOR claim.
 */
export function readyPregensForPlayerView(
  campaign: CampaignDetail | null | undefined,
  userId: string | null | undefined,
): CampaignPregen[] {
  if (!campaign || campaign.isOwner || !userId) return [];
  const me = campaign.members.find((m) => m.userId === userId);
  if (memberBlocksPregenClaims(me)) return [];
  return (campaign.data.pregenCharacters ?? []).filter((p) => p.status === 'ready');
}

export function memberBlocksPregenClaims(me: CampaignMember | undefined): boolean {
  if (!me) return false;
  return !!(
    me.proposalStatus === 'pending' ||
    me.proposalStatus === 'approved' ||
    me.approvedCharacterId ||
    me.proposedCharacterId
  );
}

export function pregenHandoutMeta(pregen: Pick<CampaignPregen, 'speciesLabel' | 'classLabel'>): string {
  return [pregen.speciesLabel, pregen.classLabel].filter(Boolean).join(' · ');
}
