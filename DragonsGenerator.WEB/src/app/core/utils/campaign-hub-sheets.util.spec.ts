import { emptyCampaignData } from '@core/models/Campaign/campaign';
import type { CampaignDetail, CampaignPregen } from '@core/models/Campaign/campaign';
import {
  assignedPregensForUser,
  characterFromNamedPayload,
  characterFromOwnedCloudRow,
  memberBlocksPregenClaims,
  pregenHandoutMeta,
  readyPregensForPlayerView,
} from './campaign-hub-sheets.util';

function pregen(over: Partial<CampaignPregen> = {}): CampaignPregen {
  return {
    id: 'p1',
    characterId: 'ch1',
    characterName: 'Mira',
    publicHook: 'éclaireuse',
    dmBackstory: '',
    dmSecrets: '',
    status: 'ready',
    ...over,
  };
}

function campaign(over: Partial<CampaignDetail> = {}): CampaignDetail {
  return {
    id: 'c1',
    title: 'Hub',
    role: 'player',
    isOwner: false,
    updatedAt: '',
    members: [],
    data: emptyCampaignData(),
    ...over,
  };
}

describe('campaign-hub-sheets.util', () => {
  it('maps named payload and owned cloud row', () => {
    expect(characterFromNamedPayload({ data: { totalLevel: 2 }, name: 'Aria' }).name).toBe('Aria');
    expect(characterFromNamedPayload({ data: null }).name).toBeUndefined();
    expect(characterFromNamedPayload({ data: 3 }).totalLevel).toBeUndefined();
    const owned = characterFromOwnedCloudRow({
      id: 'id1',
      name: 'Thorn',
      data: { totalLevel: 3 },
    });
    expect(owned.id).toBe('id1');
    expect(owned.name).toBe('Thorn');
    expect(owned.totalLevel).toBe(3);
    expect(characterFromOwnedCloudRow({ id: 'x', name: 'Y', data: null }).id).toBe('x');
  });

  it('filters assigned / ready pregens and claim lock', () => {
    const assigned = pregen({ id: 'a', assignedUserId: 'u1', status: 'assigned' });
    const claimed = pregen({ id: 'b', assignedUserId: 'u1', status: 'claimed' });
    const ready = pregen({ id: 'c', status: 'ready' });
    expect(assignedPregensForUser(undefined, 'u1')).toEqual([]);
    expect(assignedPregensForUser([assigned, claimed, ready], null)).toEqual([]);
    expect(assignedPregensForUser([assigned, claimed, ready], 'u1').map((p) => p.id)).toEqual([
      'a',
      'b',
    ]);

    expect(memberBlocksPregenClaims(undefined)).toBeFalse();
    expect(
      memberBlocksPregenClaims({
        id: 'm',
        userId: 'u1',
        displayName: 'A',
        role: 'player',
        xpEarnedInCampaign: 0,
        proposalStatus: 'pending',
      }),
    ).toBeTrue();
    expect(
      memberBlocksPregenClaims({
        id: 'm',
        userId: 'u1',
        displayName: 'A',
        role: 'player',
        xpEarnedInCampaign: 0,
        proposalStatus: 'none',
        proposedCharacterId: 'ch',
      }),
    ).toBeTrue();
    expect(
      memberBlocksPregenClaims({
        id: 'm',
        userId: 'u1',
        displayName: 'A',
        role: 'player',
        xpEarnedInCampaign: 0,
        proposalStatus: 'none',
      }),
    ).toBeFalse();

    expect(readyPregensForPlayerView(null, 'u1')).toEqual([]);
    expect(readyPregensForPlayerView(campaign({ isOwner: true }), 'u1')).toEqual([]);
    expect(readyPregensForPlayerView(campaign(), null)).toEqual([]);
    expect(
      readyPregensForPlayerView(
        campaign({
          data: { ...emptyCampaignData(), pregenCharacters: [ready] },
          members: [
            {
              id: 'm',
              userId: 'u1',
              displayName: 'A',
              role: 'player',
              xpEarnedInCampaign: 0,
              proposalStatus: 'approved',
              approvedCharacterId: 'ch',
            },
          ],
        }),
        'u1',
      ),
    ).toEqual([]);
    expect(
      readyPregensForPlayerView(
        campaign({ data: { ...emptyCampaignData(), pregenCharacters: [ready] } }),
        'u1',
      ).map((p) => p.id),
    ).toEqual(['c']);
  });

  it('joins pregen handout meta', () => {
    expect(pregenHandoutMeta({ speciesLabel: 'Elfe', classLabel: 'Rôdeur' })).toBe('Elfe · Rôdeur');
    expect(pregenHandoutMeta({})).toBe('');
    expect(pregenHandoutMeta({ speciesLabel: 'Nain' })).toBe('Nain');
  });
});
