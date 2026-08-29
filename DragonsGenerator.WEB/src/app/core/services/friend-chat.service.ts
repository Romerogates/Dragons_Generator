import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';

export type FriendMessageAttachmentKind = 'character' | 'campaign';

export interface FriendMessage {
  id: string;
  senderId: string;
  senderDisplayName: string;
  recipientId: string;
  body: string;
  attachmentKind?: string | null;
  attachmentPayload?: string | null;
  createdAt: string;
  isMine: boolean;
}

export interface FriendChatSummary {
  friendUserId: string;
  friendDisplayName: string;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
}

export interface SendFriendMessageOptions {
  body?: string;
  attachmentKind?: FriendMessageAttachmentKind;
  attachmentPayload?: string;
}

@Injectable({ providedIn: 'root' })
export class FriendChatService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = environment.apiUrl;

  listMessages(friendUserId: string, after?: string): Observable<FriendMessage[]> {
    if (!this.auth.isLoggedIn()) return of([]);
    const params: Record<string, string> = {};
    if (after) params['after'] = after;
    return this.http.get<FriendMessage[]>(`${this.api}/me/friends/${friendUserId}/messages`, {
      params,
    });
  }

  sendMessage(friendUserId: string, options: SendFriendMessageOptions): Observable<FriendMessage> {
    return this.http.post<FriendMessage>(`${this.api}/me/friends/${friendUserId}/messages`, {
      body: options.body ?? '',
      attachmentKind: options.attachmentKind ?? null,
      attachmentPayload: options.attachmentPayload ?? null,
    });
  }

  markRead(friendUserId: string): Observable<void> {
    return this.http.post<void>(`${this.api}/me/friends/${friendUserId}/messages/read`, {});
  }

  listSummaries(): Observable<FriendChatSummary[]> {
    if (!this.auth.isLoggedIn()) return of([]);
    return this.http.get<FriendChatSummary[]>(`${this.api}/me/friends/messages/summaries`);
  }
}
