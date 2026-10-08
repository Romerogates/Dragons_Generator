export interface SupportTicket {
  id: string;
  subject: string;
  message: string;
  status: string;
  attachmentOriginalName?: string;
  attachmentUrl?: string;
  characterId?: string;
  characterName?: string;
  campaignId?: string;
  campaignName?: string;
  createdAt: string;
  updatedAt?: string;
  userEmail?: string;
  adminNotes?: string;
  messageCount?: number;
}

export interface SupportTicketMessage {
  id: string;
  fromStaff: boolean;
  body: string;
  createdAt: string;
  characterId?: string;
  characterName?: string;
  attachmentOriginalName?: string;
  campaignId?: string;
  campaignName?: string;
}

export interface SupportTicketThread {
  ticket: SupportTicket;
  messages: SupportTicketMessage[];
  canEmailPlayer?: boolean;
}
