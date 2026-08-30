export type NotificationType =
  | 'friend_request'
  | 'friend_message'
  | 'campaign_invite'
  | 'character_proposal'
  | 'proposal_rejected'
  | 'proposal_approved';

export interface NotificationItem {
  key: string;
  kind: NotificationType;
  title: string;
  message: string;
  actionPath: string;
  createdAt: string;
}

export interface NotificationsSummary {
  friendsActionCount: number;
  campaignsActionCount: number;
  totalCount: number;
  notifications: NotificationItem[];
}
