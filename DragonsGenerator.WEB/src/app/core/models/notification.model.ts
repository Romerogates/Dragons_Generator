export type NotificationType =
  | 'friend_request'
  | 'campaign_invite'
  | 'character_proposal'
  | 'proposal_rejected';

export interface NotificationItem {
  id: string;
  type: NotificationType;
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
