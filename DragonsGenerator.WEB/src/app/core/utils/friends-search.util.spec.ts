import {
  FRIENDS_SEARCH_MIN_LENGTH,
  formatMemberSince,
  pickRecentFriends,
  relationshipStatusLabel,
  shouldTriggerFriendsSearch,
} from './friends-search.util';
import { FriendUser } from '@core/models/Campaign/campaign';

describe('friends-search.util', () => {
  it('requires at least 4 characters to search', () => {
    expect(FRIENDS_SEARCH_MIN_LENGTH).toBe(4);
    expect(shouldTriggerFriendsSearch('abc')).toBeFalse();
    expect(shouldTriggerFriendsSearch('abcd')).toBeTrue();
    expect(shouldTriggerFriendsSearch('  hero  ')).toBeTrue();
  });

  it('picks recent friends by friendSince desc', () => {
    const friends: FriendUser[] = [
      { id: '1', displayName: 'Alpha', friendSince: '2024-01-01T00:00:00Z' },
      { id: '2', displayName: 'Beta', friendSince: '2025-06-01T00:00:00Z' },
      { id: '3', displayName: 'Gamma', friendSince: '2025-01-01T00:00:00Z' },
    ];
    const recent = pickRecentFriends(friends, 2);
    expect(recent.map((f) => f.id)).toEqual(['2', '3']);
  });

  it('sorts friends without friendSince after dated ones', () => {
    const friends: FriendUser[] = [
      { id: '1', displayName: 'Zeta' },
      { id: '2', displayName: 'Alpha', friendSince: '2025-01-01T00:00:00Z' },
    ];
    expect(pickRecentFriends(friends)[0]?.id).toBe('2');
  });

  it('labels relationship statuses', () => {
    expect(relationshipStatusLabel('friend')).toBe('Ami');
    expect(relationshipStatusLabel('pending_sent')).toBe('Demande envoyée');
    expect(relationshipStatusLabel('pending_received')).toBe('Vous a demandé');
    expect(relationshipStatusLabel('none')).toBeNull();
  });

  it('formats member since in French locale', () => {
    const label = formatMemberSince('2024-03-15T12:00:00Z');
    expect(label).toMatch(/2024/);
    expect(formatMemberSince('not-a-date')).toBe('');
  });
});
