import type { CampaignActivityItem } from '@core/services/campaign-cloud.service';
import {
  activityDetail,
  activityIcon,
  activityLabel,
  handoutIdFromActivity,
  relativeActivityTime,
} from '../../features/campaigns/campaign-detail/campaign-activity.util';

function item(partial: Partial<CampaignActivityItem> & Pick<CampaignActivityItem, 'kind'>): CampaignActivityItem {
  return {
    id: 'a1',
    actorUserId: 'u1',
    actorDisplayName: 'MJ',
    createdAt: new Date().toISOString(),
    payloadJson: '',
    ...partial,
  };
}

describe('campaign-activity.util', () => {
  it('maps known labels and icons', () => {
    expect(activityLabel('handout_published')).toBe('Document publié');
    expect(activityLabel('schedule_rsvp')).toBe('RSVP agenda');
    expect(activityLabel('combat_ended')).toBe('Combat terminé');
    expect(activityLabel('unknown_event')).toBe('unknown event');
    expect(activityIcon('xp_awarded')).toContain('sparkles');
    expect(activityIcon('schedule_rsvp')).toContain('raising-hands');
    expect(activityIcon('combat_ended')).toContain('crossed-swords');
    expect(activityIcon('zzz')).toContain('memo');
  });

  it('parses activity detail payloads', () => {
    expect(activityDetail(item({ kind: 'xp_awarded', payloadJson: '{"message":" +50 XP "}' }))).toBe('+50 XP');
    expect(
      activityDetail(
        item({
          kind: 'combat_ended',
          payloadJson: '{"message":"Combat terminé — Embuscade · tour 4"}',
        }),
      ),
    ).toBe('Combat terminé — Embuscade · tour 4');
    expect(
      activityDetail(
        item({
          kind: 'character_proposed',
          payloadJson: '{"displayName":"Ana","characterName":"Elara"}',
        }),
      ),
    ).toBe('Ana · Elara');
    expect(
      activityDetail(item({ kind: 'character_proposed', payloadJson: '{"characterName":"Solo"}' })),
    ).toBe('Solo');
    expect(
      activityDetail(item({ kind: 'session_scheduled', payloadJson: '{"title":"S1","location":"Discord"}' })),
    ).toBe('S1 · Discord');
    expect(activityDetail(item({ kind: 'session_scheduled', payloadJson: '{"title":"S2"}' }))).toBe('S2');
    expect(activityDetail(item({ kind: 'invite_sent', payloadJson: '{"campaignTitle":"Camp"}' }))).toBe('Camp');
    expect(activityDetail(item({ kind: 'invite_sent', payloadJson: '{}' }))).toBeNull();
    expect(activityDetail(item({ kind: 'invite_sent', payloadJson: 'not-json' }))).toBeNull();
    expect(activityDetail(item({ kind: 'invite_sent', payloadJson: '' }))).toBeNull();
  });

  it('extracts handout id from published activity', () => {
    expect(handoutIdFromActivity(item({ kind: 'xp_awarded' }))).toBeNull();
    expect(
      handoutIdFromActivity(item({ kind: 'handout_published', payloadJson: '{"handoutId":"h-9"}' })),
    ).toBe('h-9');
  });

  it('formats relative activity time', () => {
    const now = Date.now();
    expect(relativeActivityTime(new Date(now - 10_000).toISOString())).toBe('à l’instant');
    expect(relativeActivityTime(new Date(now - 120_000).toISOString())).toContain('min');
    expect(relativeActivityTime('not-a-date')).toBe('');
  });
});
