import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@env/environment';
import { AuthService } from './auth.service';
import {
  CampaignData,
  CampaignDetail,
  CampaignSummary,
  emptyCampaignData,
  normalizeHandoutKind,
} from '../models/Campaign/campaign';

export interface CampaignActivityItem {
  id: string;
  actorUserId: string;
  actorDisplayName: string;
  kind: string;
  payloadJson: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class CampaignCloudService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly api = environment.apiUrl;

  list(): Observable<CampaignSummary[]> {
    if (!this.auth.isLoggedIn()) return of([]);
    return this.http.get<CampaignSummary[]>(`${this.api}/me/campaigns`);
  }

  get(id: string): Observable<CampaignDetail> {
    return this.http.get<{
      id: string;
      title: string;
      data: CampaignData;
      role: 'dm' | 'player';
      isOwner: boolean;
      updatedAt: string;
      members: CampaignDetail['members'];
    }>(`${this.api}/me/campaigns/${id}`).pipe(
      map((r) => ({
        id: r.id,
        title: r.title,
        data: this.normalizeData(r.data),
        role: r.role,
        isOwner: r.isOwner,
        updatedAt: r.updatedAt,
        members: r.members,
      })),
    );
  }

  create(title: string, data: CampaignData): Observable<CampaignSummary> {
    return this.http.post<CampaignSummary>(`${this.api}/me/campaigns`, {
      title,
      data,
    });
  }

  update(id: string, title: string, data: CampaignData): Observable<CampaignSummary> {
    return this.http.put<CampaignSummary>(`${this.api}/me/campaigns/${id}`, {
      title,
      data,
    });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/me/campaigns/${id}`);
  }

  invitePlayer(campaignId: string, userId: string): Observable<void> {
    return this.http.post<void>(`${this.api}/me/campaigns/${campaignId}/invites`, { userId });
  }

  proposeCharacter(campaignId: string, characterId: string): Observable<void> {
    return this.http.post<void>(`${this.api}/me/campaigns/${campaignId}/propose-character`, {
      characterId,
    });
  }

  approveProposal(campaignId: string, memberId: string): Observable<void> {
    return this.http.post<void>(
      `${this.api}/me/campaigns/${campaignId}/members/${memberId}/approve`,
      {},
    );
  }

  rejectProposal(campaignId: string, memberId: string): Observable<void> {
    return this.http.post<void>(
      `${this.api}/me/campaigns/${campaignId}/members/${memberId}/reject`,
      {},
    );
  }

  requestCharacterPick(campaignId: string, memberId: string): Observable<void> {
    return this.http.post<void>(
      `${this.api}/me/campaigns/${campaignId}/members/${memberId}/request-character`,
      {},
    );
  }

  removeMember(campaignId: string, memberId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/me/campaigns/${campaignId}/members/${memberId}`);
  }

  awardXp(campaignId: string, memberId: string, xp: number): Observable<{ xpEarnedInCampaign: number }> {
    return this.http.post<{ xpEarnedInCampaign: number }>(
      `${this.api}/me/campaigns/${campaignId}/award-xp`,
      { memberId, xp },
    );
  }

  assignPregen(
    campaignId: string,
    pregenId: string,
    userId: string,
    displayName: string,
  ): Observable<void> {
    return this.http.post<void>(`${this.api}/me/campaigns/${campaignId}/pregens/${pregenId}/assign`, {
      userId,
      displayName,
    });
  }

  claimPregen(campaignId: string, pregenId: string): Observable<{ characterId: string }> {
    return this.http.post<{ characterId: string }>(
      `${this.api}/me/campaigns/${campaignId}/pregens/${pregenId}/claim`,
      {},
    );
  }

  getPregenCharacter(
    campaignId: string,
    pregenId: string,
  ): Observable<{ id: string; name: string; data: unknown }> {
    return this.http.get<{ id: string; name: string; data: unknown }>(
      `${this.api}/me/campaigns/${campaignId}/pregens/${pregenId}/character`,
    );
  }

  getMemberCharacter(
    campaignId: string,
    memberId: string,
    scope: 'proposed' | 'approved' = 'approved',
  ): Observable<{ id: string; name: string; data: unknown }> {
    return this.http.get<{ id: string; name: string; data: unknown }>(
      `${this.api}/me/campaigns/${campaignId}/members/${memberId}/character`,
      { params: { scope } },
    );
  }

  private normalizeData(raw: Partial<CampaignData> | null | undefined): CampaignData {
    const base = emptyCampaignData();
    if (!raw) return base;
    return {
      setting: raw.setting ?? base.setting,
      regionId: raw.regionId ?? base.regionId,
      regionName: raw.regionName ?? base.regionName,
      partyLevel: raw.partyLevel ?? base.partyLevel,
      tone: raw.tone ?? base.tone,
      adventure: raw.adventure ?? base.adventure,
      creatures: Array.isArray(raw.creatures) ? raw.creatures : [],
      encounters: Array.isArray(raw.encounters) ? raw.encounters : [],
      notes: raw.notes ?? base.notes,
      pregenCharacters: Array.isArray(raw.pregenCharacters) ? raw.pregenCharacters : [],
      sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
      handouts: Array.isArray(raw.handouts)
        ? raw.handouts.map((h) => ({
            ...h,
            kind: normalizeHandoutKind((h as { kind?: unknown }).kind),
          }))
        : [],
      activeSessionId: raw.activeSessionId ?? null,
      dungeonMaps: Array.isArray(raw.dungeonMaps) ? raw.dungeonMaps : [],
    };
  }

  listActivity(campaignId: string, limit = 50): Observable<CampaignActivityItem[]> {
    return this.http.get<CampaignActivityItem[]>(`${this.api}/me/campaigns/${campaignId}/activity`, {
      params: { limit: String(limit) },
    });
  }

  getInitiativeBoard(campaignId: string): Observable<InitiativeBoard> {
    return this.http.get<InitiativeBoard>(`${this.api}/me/campaigns/${campaignId}/initiative`);
  }

  submitInitiative(
    campaignId: string,
    body: { code: string; combatantId: string; roll: number },
  ): Observable<void> {
    return this.http.post<void>(`${this.api}/me/campaigns/${campaignId}/initiative/submit`, body);
  }
}

export interface InitiativeBoard {
  open: boolean;
  code: string | null;
  label: string | null;
  combatants: InitiativeBoardCombatant[];
}

export interface InitiativeBoardCombatant {
  id: string;
  name: string;
  kind: string;
  initiativeBonus: number;
  hasRoll: boolean;
  memberUserId: string | null;
}
