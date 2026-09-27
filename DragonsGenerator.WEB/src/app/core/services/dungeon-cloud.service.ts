import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';
import type { CampaignDungeonMap } from '@core/models/Campaign/dungeon-map';

export interface CloudDungeonSummary {
  id: string;
  name: string;
  updatedAt: string;
}

export interface CloudDungeonDetail {
  id: string;
  name: string;
  data: CampaignDungeonMap;
  updatedAt: string;
}

/** Limite serveur CreateMyDungeonEndpoint.MaxDungeonsPerUser */
export const MAX_DUNGEONS_PER_USER = 40;

@Injectable({ providedIn: 'root' })
export class DungeonCloudService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = environment.apiUrl;

  list(): Observable<CloudDungeonSummary[]> {
    if (!this.auth.isLoggedIn()) return of([]);
    return this.http.get<CloudDungeonSummary[]>(`${this.api}/me/dungeons`);
  }

  get(id: string): Observable<CloudDungeonDetail> {
    return this.http.get<CloudDungeonDetail>(`${this.api}/me/dungeons/${id}`);
  }

  create(map: CampaignDungeonMap, name?: string): Observable<CloudDungeonSummary> {
    return this.http.post<CloudDungeonSummary>(`${this.api}/me/dungeons`, {
      name: name ?? map.name ?? 'Sans nom',
      data: map,
    });
  }

  update(id: string, map: CampaignDungeonMap, name?: string): Observable<CloudDungeonSummary> {
    return this.http.put<CloudDungeonSummary>(`${this.api}/me/dungeons/${id}`, {
      name: name ?? map.name ?? 'Sans nom',
      data: map,
    });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/me/dungeons/${id}`);
  }

  /** Lecture ami (pièce jointe chat). */
  getFriendDungeon(friendUserId: string, dungeonId: string): Observable<CloudDungeonDetail> {
    return this.http.get<CloudDungeonDetail>(
      `${this.api}/me/friends/${friendUserId}/dungeons/${dungeonId}`,
    );
  }

  getShareLink(id: string): Observable<{ token: string | null; enabled: boolean; createdAt: string | null }> {
    return this.http.get<{ token: string | null; enabled: boolean; createdAt: string | null }>(
      `${this.api}/me/dungeons/${id}/share-link`,
    );
  }

  createShareLink(id: string): Observable<{ token: string | null; enabled: boolean; createdAt: string | null }> {
    return this.http.post<{ token: string | null; enabled: boolean; createdAt: string | null }>(
      `${this.api}/me/dungeons/${id}/share-link`,
      {},
    );
  }

  revokeShareLink(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/me/dungeons/${id}/share-link`);
  }

  getSharedDungeon(token: string): Observable<{
    id: string;
    name: string;
    ownerDisplayName: string;
    data: CampaignDungeonMap;
    updatedAt: string;
  }> {
    return this.http.get<{
      id: string;
      name: string;
      ownerDisplayName: string;
      data: CampaignDungeonMap;
      updatedAt: string;
    }>(`${this.api}/dungeons/shared/${encodeURIComponent(token)}/data`);
  }

  importFromShare(token: string): Observable<CloudDungeonSummary> {
    return this.http.post<CloudDungeonSummary>(
      `${this.api}/me/dungeons/from-share/${encodeURIComponent(token)}`,
      {},
    );
  }
}
