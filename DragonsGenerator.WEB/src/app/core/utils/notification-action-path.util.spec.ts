import {
  notificationActionQueryParams,
  parseNotificationActionPath,
} from './notification-action-path.util';

describe('parseNotificationActionPath', () => {
  it('keeps a path without query as router commands', () => {
    expect(parseNotificationActionPath('/friends')).toEqual({
      commands: ['/', 'friends'],
      queryParams: {},
    });
    expect(notificationActionQueryParams(parseNotificationActionPath('/friends'))).toBeNull();
  });

  it('splits campaign tab and ticket query strings', () => {
    const players = parseNotificationActionPath('/campaigns/abc?tab=players');
    expect(players.commands).toEqual(['/', 'campaigns', 'abc']);
    expect(players.queryParams).toEqual({ tab: 'players' });

    const xp = parseNotificationActionPath('/campaigns/abc?tab=players&levelUp=1');
    expect(xp.queryParams).toEqual({ tab: 'players', levelUp: '1' });

    const support = parseNotificationActionPath('/support?ticket=tid-1');
    expect(support.commands).toEqual(['/', 'support']);
    expect(support.queryParams).toEqual({ ticket: 'tid-1' });
    expect(notificationActionQueryParams(support)).toEqual({ ticket: 'tid-1' });
  });

  it('handles invite highlight and nested chat paths', () => {
    const invite = parseNotificationActionPath('/campaigns?invite=inv-9');
    expect(invite.commands).toEqual(['/', 'campaigns']);
    expect(invite.queryParams).toEqual({ invite: 'inv-9' });

    const chat = parseNotificationActionPath('/friends/chat/user-2');
    expect(chat.commands).toEqual(['/', 'friends', 'chat', 'user-2']);
  });

  it('falls back on empty path', () => {
    expect(parseNotificationActionPath('')).toEqual({ commands: ['/'], queryParams: {} });
    expect(parseNotificationActionPath(null)).toEqual({ commands: ['/'], queryParams: {} });
  });
});
