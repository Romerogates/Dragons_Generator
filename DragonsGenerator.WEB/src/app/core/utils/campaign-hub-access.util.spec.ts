import {
  campaignIsSupportInspect,
  campaignJoinSharePayload,
  campaignJoinUrl,
  campaignLoginReturnUrl,
  campaignMjUi,
  clipboardCopyFeedback,
  copyTextToClipboard,
  friendsInviteUrl,
  joinLinkShareFallbackFeedback,
} from './campaign-hub-access.util';

describe('campaign-hub-access.util', () => {
  it('treats support role or ?support=1 as inspection', () => {
    expect(campaignIsSupportInspect('support', null)).toBeTrue();
    expect(campaignIsSupportInspect('dm', '1')).toBeTrue();
    expect(campaignIsSupportInspect('player', null)).toBeFalse();
    expect(campaignIsSupportInspect('player', '0')).toBeFalse();
  });

  it('shows MJ screens for owner or support inspect', () => {
    expect(campaignMjUi(null, null)).toBeFalse();
    expect(campaignMjUi({ isOwner: true }, null)).toBeTrue();
    expect(campaignMjUi({ isOwner: false, role: 'support' }, null)).toBeTrue();
    expect(campaignMjUi({ isOwner: false, role: 'player' }, '1')).toBeTrue();
    expect(campaignMjUi({ isOwner: false, role: 'player' }, null)).toBeFalse();
  });

  it('builds a login return URL to the campaign', () => {
    expect(campaignLoginReturnUrl('abc', '/elsewhere')).toBe('/campaigns/abc');
    expect(campaignLoginReturnUrl(null, '/campaigns/xyz?tab=prep')).toBe(
      '/campaigns/xyz?tab=prep',
    );
    expect(campaignLoginReturnUrl(null, '/')).toBe('/campaigns');
    expect(campaignLoginReturnUrl(null, '')).toBe('/campaigns');
  });

  it('builds join / friends URLs and clipboard feedback', async () => {
    expect(campaignJoinUrl('http://localhost:8081/', 'tok')).toBe('http://localhost:8081/join/tok');
    expect(friendsInviteUrl('http://localhost:8081')).toBe('http://localhost:8081/friends');
    expect(campaignJoinSharePayload('Table', 'http://x/join/t').text).toContain('Table');
    expect(clipboardCopyFeedback('ok', 'join')).toContain('invitation');
    expect(clipboardCopyFeedback('ok', 'friends')).toContain('Amis');
    expect(clipboardCopyFeedback('unavailable', 'join')).toContain('Presse-papiers');
    expect(clipboardCopyFeedback('fail', 'friends')).toContain('Impossible');
    expect(joinLinkShareFallbackFeedback('unavailable')).toContain('Partage');
    expect(joinLinkShareFallbackFeedback('ok')).toContain('invitation');
    expect(await copyTextToClipboard('x', null)).toBe('unavailable');
    expect(await copyTextToClipboard('x', { writeText: async () => undefined })).toBe('ok');
    expect(
      await copyTextToClipboard('x', {
        writeText: async () => {
          throw new Error('denied');
        },
      }),
    ).toBe('fail');
  });
});
