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

export interface AgendaEventDto {
  id: string;
  /** Null = date personnelle (hors campagne). */
  campaignId: string | null;
  campaignTitle: string;
  source: 'schedule' | 'session' | 'personal' | string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  allDay: boolean;
  kind?: string | null;
  status?: string | null;
  location?: string | null;
  characterId?: string | null;
  characterName?: string | null;
  rsvpYes?: number;
  rsvpNo?: number;
  rsvpMaybe?: number;
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

  /** Agenda global : dates + sessions de toutes les campagnes actives. */
  listAgenda(): Observable<AgendaEventDto[]> {
    if (!this.auth.isLoggedIn()) return of([]);
    return this.http.get<AgendaEventDto[]>(`${this.api}/me/agenda`);
  }

  /** Date perso (héros / hors campagne). */
  createPersonalAgendaEvent(body: {
    title: string;
    startsAt: string;
    endsAt?: string | null;
    allDay?: boolean;
    kind?: string;
    location?: string;
    notes?: string;
    characterId?: string | null;
  }): Observable<AgendaEventDto> {
    return this.http.post<AgendaEventDto>(`${this.api}/me/agenda/personal`, body);
  }

  deletePersonalAgendaEvent(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/me/agenda/personal/${encodeURIComponent(id)}`);
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
      isArchived?: boolean;
      isClosed?: boolean;
      isHistory?: boolean;
      membershipStatus?: CampaignDetail['membershipStatus'];
      hasPlayerHistory?: boolean;
    }>(`${this.api}/me/campaigns/${id}`).pipe(
      map((r) => ({
        id: r.id,
        title: r.title,
        data: this.normalizeData(r.data),
        role: r.role,
        isOwner: r.isOwner,
        updatedAt: r.updatedAt,
        members: r.members,
        isArchived: !!r.isArchived,
        isClosed: !!r.isClosed,
        isHistory: !!r.isHistory,
        membershipStatus: r.membershipStatus ?? (r.isHistory ? 'closed' : 'active'),
        hasPlayerHistory: !!r.hasPlayerHistory,
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

  /** Archivage personnel (masquer sans quitter). */
  setArchived(id: string, archived: boolean): Observable<void> {
    return this.http.put<void>(`${this.api}/me/campaigns/${id}/archive`, { archived });
  }

  invitePlayer(campaignId: string, userId: string): Observable<void> {
    return this.http.post<void>(`${this.api}/me/campaigns/${campaignId}/invites`, { userId });
  }

  /** Invitations en attente (vue MJ). */
  listPendingInvites(campaignId: string): Observable<CampaignPendingInvite[]> {
    return this.http.get<CampaignPendingInvite[]>(`${this.api}/me/campaigns/${campaignId}/invites`);
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

  /** Le joueur connecté quitte lui-même la campagne (le MJ ne peut pas quitter la sienne). */
  leaveCampaign(campaignId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/me/campaigns/${campaignId}/leave`);
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

  claimPregen(campaignId: string, pregenId: string): Observable<{ id: string; name: string }> {
    return this.http.post<{ id: string; name: string }>(
      `${this.api}/me/campaigns/${campaignId}/pregens/${pregenId}/claim`,
      {},
    );
  }

  usePregenAtTable(campaignId: string, pregenId: string): Observable<void> {
    return this.http.post<void>(
      `${this.api}/me/campaigns/${campaignId}/pregens/${pregenId}/use-at-table`,
      {},
    );
  }

  getJoinLink(campaignId: string): Observable<CampaignJoinLink> {
    return this.http.get<CampaignJoinLink>(`${this.api}/me/campaigns/${campaignId}/join-link`);
  }

  createOrRotateJoinLink(campaignId: string): Observable<CampaignJoinLink> {
    return this.http.post<CampaignJoinLink>(`${this.api}/me/campaigns/${campaignId}/join-link`, {});
  }

  revokeJoinLink(campaignId: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/me/campaigns/${campaignId}/join-link`);
  }

  previewJoin(token: string): Observable<CampaignJoinPreview> {
    return this.http.get<CampaignJoinPreview>(`${this.api}/join/${encodeURIComponent(token)}`);
  }

  joinByToken(token: string): Observable<CampaignSummary> {
    return this.http.post<CampaignSummary>(`${this.api}/me/join/${encodeURIComponent(token)}`, {});
  }

  joinAsSpectator(token: string): Observable<CampaignSummary> {
    return this.http.post<CampaignSummary>(
      `${this.api}/me/join/${encodeURIComponent(token)}/spectator`,
      {},
    );
  }

  setMemberSpectator(campaignId: string, memberId: string): Observable<void> {
    return this.http.post<void>(
      `${this.api}/me/campaigns/${campaignId}/members/${memberId}/spectator`,
      {},
    );
  }

  setScheduleRsvp(
    campaignId: string,
    eventId: string,
    status: 'yes' | 'no' | 'maybe',
  ): Observable<{ userId: string; displayName?: string; status: string; at: string }[]> {
    return this.http.post<{ userId: string; displayName?: string; status: string; at: string }[]>(
      `${this.api}/me/campaigns/${campaignId}/schedule/${encodeURIComponent(eventId)}/rsvp`,
      { status },
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
      notebookPages: Array.isArray(raw.notebookPages) ? raw.notebookPages : base.notebookPages,
      sessionResume: raw.sessionResume ?? base.sessionResume,
      pregenCharacters: Array.isArray(raw.pregenCharacters) ? raw.pregenCharacters : [],
      sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
      scheduleEvents: Array.isArray(raw.scheduleEvents) ? raw.scheduleEvents : [],
      handouts: Array.isArray(raw.handouts)
        ? raw.handouts.map((h) => ({
            ...h,
            kind: normalizeHandoutKind((h as { kind?: unknown }).kind),
          }))
        : [],
      activeSessionId: raw.activeSessionId ?? null,
      pinnedHandoutId: raw.pinnedHandoutId ?? null,
      dungeonMaps: Array.isArray(raw.dungeonMaps) ? raw.dungeonMaps : [],
      atlasPins: Array.isArray(raw.atlasPins) ? raw.atlasPins : [],
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

  /** Persiste PV + journal pour une attaque du joueur à son tour. */
  resolveCombatAttack(
    campaignId: string,
    body: {
      actorId: string;
      targetId: string;
      hit: boolean;
      damage?: number | null;
      logLine?: string | null;
    },
  ): Observable<void> {
    return this.http.post<void>(`${this.api}/me/campaigns/${campaignId}/combat/resolve-attack`, body);
  }

  postTableChat(campaignId: string, body: { sessionId: string; body: string }): Observable<void> {
    return this.http.post<void>(`${this.api}/me/campaigns/${campaignId}/table-chat`, body);
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

export interface CampaignJoinLink {
  token: string | null;
  enabled: boolean;
  createdAt: string | null;
}

export interface CampaignJoinPreview {
  campaignId: string;
  title: string;
  ownerDisplayName: string;
  alreadyMember: boolean;
}

export interface CampaignPendingInvite {
  id: string;
  userId: string;
  displayName: string;
  createdAt: string;
}
