import {
  FriendRelationshipStatus,
  FriendUser,
} from '@core/models/Campaign/campaign';

export const FRIENDS_SEARCH_MIN_LENGTH = 4;
export const FRIENDS_SEARCH_DEBOUNCE_MS = 300;
export const RECENT_FRIENDS_LIMIT = 5;

export function shouldTriggerFriendsSearch(query: string): boolean {
  return query.trim().length >= FRIENDS_SEARCH_MIN_LENGTH;
}

export function pickRecentFriends(
  friends: FriendUser[],
  limit = RECENT_FRIENDS_LIMIT,
): FriendUser[] {
  return [...friends]
    .sort((a, b) => {
      const ta = a.friendSince ? Date.parse(a.friendSince) : 0;
      const tb = b.friendSince ? Date.parse(b.friendSince) : 0;
      return tb - ta || a.displayName.localeCompare(b.displayName, 'fr');
    })
    .slice(0, limit);
}

export function relationshipStatusLabel(
  status: FriendRelationshipStatus,
): string | null {
  switch (status) {
    case 'friend':
      return 'Ami';
    case 'pending_sent':
      return 'Demande envoyée';
    case 'pending_received':
      return 'Vous a demandé';
    default:
      return null;
  }
}

export function formatMemberSince(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
}
