import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';
import { CampaignInvite, FriendRequest, FriendUser } from '../models/Campaign/campaign';

@Injectable({ providedIn: 'root' })
export class FriendsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = environment.apiUrl;

  searchUsers(q: string): Observable<FriendUser[]> {
    if (!this.auth.isLoggedIn() || q.trim().length < 2) return of([]);
    return this.http.get<FriendUser[]>(`${this.api}/users/search`, { params: { q } });
  }

  listFriends(): Observable<FriendUser[]> {
    if (!this.auth.isLoggedIn()) return of([]);
    return this.http.get<FriendUser[]>(`${this.api}/me/friends`);
  }

  listIncomingRequests(): Observable<FriendRequest[]> {
    if (!this.auth.isLoggedIn()) return of([]);
    return this.http.get<FriendRequest[]>(`${this.api}/me/friends/requests`);
  }

  listSentRequests(): Observable<FriendRequest[]> {
    if (!this.auth.isLoggedIn()) return of([]);
    return this.http.get<FriendRequest[]>(`${this.api}/me/friends/requests/sent`);
  }

  cancelRequest(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/me/friends/requests/${id}`);
  }

  sendRequest(userId: string): Observable<void> {
    return this.http.post<void>(`${this.api}/me/friends/request`, { userId });
  }

  acceptRequest(id: string): Observable<void> {
    return this.http.post<void>(`${this.api}/me/friends/requests/${id}/accept`, {});
  }

  declineRequest(id: string): Observable<void> {
    return this.http.post<void>(`${this.api}/me/friends/requests/${id}/decline`, {});
  }

  listCampaignInvites(): Observable<CampaignInvite[]> {
    if (!this.auth.isLoggedIn()) return of([]);
    return this.http.get<CampaignInvite[]>(`${this.api}/me/campaign-invites`);
  }

  acceptCampaignInvite(id: string): Observable<void> {
    return this.http.post<void>(`${this.api}/me/campaign-invites/${id}/accept`, {});
  }

  declineCampaignInvite(id: string): Observable<void> {
    return this.http.post<void>(`${this.api}/me/campaign-invites/${id}/decline`, {});
  }

  removeFriend(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/me/friends/${userId}`);
  }
}
