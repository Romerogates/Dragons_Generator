import { Injectable, inject } from '@angular/core';
import { CampaignCloudService } from '@core/services/campaign-cloud.service';
import type { CampaignMember, CampaignScheduleEvent, CampaignSession } from '@core/models/Campaign/campaign';
import {
  inviteErrorMessage,
  linkScheduleEventToSession,
  plannedSessionFromScheduleEvent,
  scheduleRsvpFeedback,
  scheduleYesInviteUserIds,
} from '@core/utils/campaign-hub-write.util';
import {
  campaignJoinUrl,
  clipboardCopyFeedback,
  copyTextToClipboard,
  friendsInviteUrl,
  type ClipboardLike,
} from '@core/utils/campaign-hub-access.util';
import { CampaignHubStore, type CampaignHubSyncHooks } from './campaign-hub.store';
import { CampaignHubSyncService } from './campaign-hub-sync.service';

/**
 * Roster HTTP : invites, lien, propositions, archive / quitter / supprimer.
 * Persist sessions (convert calendrier) = store.saveData uniquement.
 */
@Injectable()
export class CampaignHubMembersService {
  private readonly hub = inject(CampaignHubStore);
  private readonly sync = inject(CampaignHubSyncService);
  private readonly campaigns = inject(CampaignCloudService);
  private archiveNoticeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.sync.configureOwnerReload(() => {
      this.loadPendingInvites();
      this.loadJoinLink();
    });
    this.hub.registerTeardown(() => {
      if (this.archiveNoticeTimer) clearTimeout(this.archiveNoticeTimer);
    });
  }

  inviteFriend(userId: string, displayName: string, hooks?: CampaignHubSyncHooks): void {
    const c = this.hub.campaign();
    if (!c) return;
    this.campaigns.invitePlayer(c.id, userId).subscribe({
      next: () => {
        this.hub.error.set(null);
        this.hub.pendingInviteUserIds.update((prev) => new Set([...prev, userId]));
        this.hub.rosterFeedback.set(`Invitation envoyée à ${displayName}.`);
        hooks?.onOk?.();
      },
      error: (err: unknown) => {
        this.hub.error.set(inviteErrorMessage(err));
        hooks?.onFail?.();
      },
    });
  }

  markPendingInvite(userId: string): void {
    this.hub.pendingInviteUserIds.update((prev) => new Set([...prev, userId]));
  }

  prunePendingInvites(memberUserIds: Set<string>): void {
    this.hub.pendingInviteUserIds.update((prev) => {
      const next = new Set([...prev].filter((id) => !memberUserIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }

  loadPendingInvites(): void {
    const c = this.hub.campaign();
    if (!c?.isOwner) {
      this.hub.pendingInvites.set([]);
      return;
    }
    this.campaigns.listPendingInvites(c.id).subscribe({
      next: (list) => {
        this.hub.pendingInvites.set(list);
        this.hub.pendingInviteUserIds.set(new Set(list.map((i) => i.userId)));
      },
      error: () => {
        /* ignore */
      },
    });
  }

  loadJoinLink(): void {
    const c = this.hub.campaign();
    if (!c?.isOwner) {
      this.hub.joinLink.set(null);
      return;
    }
    this.campaigns.getJoinLink(c.id).subscribe({
      next: (link) => this.hub.joinLink.set({ token: link.token, enabled: link.enabled }),
      error: () => this.hub.joinLink.set(null),
    });
  }

  ensureJoinLinkToken(onToken: (token: string) => void): void {
    const c = this.hub.campaign();
    if (!c?.isOwner || this.hub.joinLinkBusy()) return;
    const existing = this.hub.joinLink();
    if (existing?.enabled && existing.token) {
      onToken(existing.token);
      return;
    }

    this.hub.joinLinkBusy.set(true);
    this.campaigns.createOrRotateJoinLink(c.id).subscribe({
      next: (link) => {
        this.hub.joinLink.set({ token: link.token, enabled: link.enabled });
        this.hub.joinLinkBusy.set(false);
        if (link.token) onToken(link.token);
      },
      error: () => {
        this.hub.joinLinkBusy.set(false);
        this.hub.rosterFeedback.set('Impossible de créer le lien d’invitation.');
      },
    });
  }

  rotateJoinLink(): void {
    const c = this.hub.campaign();
    if (!c?.isOwner || this.hub.joinLinkBusy()) return;
    this.hub.joinLinkBusy.set(true);
    this.campaigns.createOrRotateJoinLink(c.id).subscribe({
      next: (link) => {
        this.hub.joinLink.set({ token: link.token, enabled: link.enabled });
        this.hub.joinLinkBusy.set(false);
        this.hub.rosterFeedback.set('Nouveau lien généré — l’ancien ne fonctionne plus.');
      },
      error: () => {
        this.hub.joinLinkBusy.set(false);
        this.hub.rosterFeedback.set('Régénération impossible.');
      },
    });
  }

  revokeJoinLink(): void {
    const c = this.hub.campaign();
    if (!c?.isOwner || this.hub.joinLinkBusy()) return;
    this.hub.joinLinkBusy.set(true);
    this.campaigns.revokeJoinLink(c.id).subscribe({
      next: () => {
        this.hub.joinLink.set({ token: null, enabled: false });
        this.hub.joinLinkBusy.set(false);
        this.hub.rosterFeedback.set('Lien d’invitation désactivé.');
      },
      error: () => {
        this.hub.joinLinkBusy.set(false);
        this.hub.rosterFeedback.set('Désactivation impossible.');
      },
    });
  }

  copyJoinLink(origin: string, clipboard?: ClipboardLike | null): void {
    this.ensureJoinLinkToken((token) => {
      void copyTextToClipboard(campaignJoinUrl(origin, token), clipboard).then((result) => {
        this.hub.rosterFeedback.set(clipboardCopyFeedback(result, 'join'));
      });
    });
  }

  copyFriendsInviteLink(origin: string, clipboard?: ClipboardLike | null): void {
    void copyTextToClipboard(friendsInviteUrl(origin), clipboard).then((result) => {
      this.hub.rosterFeedback.set(clipboardCopyFeedback(result, 'friends'));
    });
  }

  proposeCharacter(characterId: string, hooks?: CampaignHubSyncHooks): void {
    const c = this.hub.campaign();
    if (!c) return;
    this.campaigns.proposeCharacter(c.id, characterId).subscribe({
      next: () => hooks?.onOk?.(),
      error: () => this.hub.error.set('Impossible de proposer ce personnage.'),
    });
  }

  approveMember(member: CampaignMember, hooks?: CampaignHubSyncHooks): void {
    const c = this.hub.campaign();
    if (!c) return;
    this.campaigns.approveProposal(c.id, member.id).subscribe({
      next: () => {
        this.hub.rosterFeedback.set(
          `${member.proposedCharacterName ?? 'Personnage'} approuvé — le joueur peut lire « Comment jouer » dans le guide.`,
        );
        hooks?.onOk?.();
      },
      error: () => this.hub.error.set('Impossible d’approuver ce personnage.'),
    });
  }

  rejectMember(member: CampaignMember, hooks?: CampaignHubSyncHooks): void {
    const c = this.hub.campaign();
    if (!c) return;
    this.campaigns.rejectProposal(c.id, member.id).subscribe({
      next: () => hooks?.onOk?.(),
      error: () => this.hub.error.set('Impossible de refuser ce personnage.'),
    });
  }

  requestCharacterPick(member: CampaignMember, hooks?: CampaignHubSyncHooks): void {
    const c = this.hub.campaign();
    if (!c || this.hub.characterRequestLoadingId()) return;
    this.hub.characterRequestLoadingId.set(member.id);
    this.hub.rosterFeedback.set(null);
    this.campaigns.requestCharacterPick(c.id, member.id).subscribe({
      next: () => {
        this.hub.characterRequestLoadingId.set(null);
        this.hub.rosterFeedback.set(`Rappel envoyé à ${member.displayName}.`);
        hooks?.onOk?.();
      },
      error: () => {
        this.hub.characterRequestLoadingId.set(null);
        this.hub.error.set('Impossible d’envoyer la demande.');
      },
    });
  }

  removeMember(member: CampaignMember, hooks?: CampaignHubSyncHooks): void {
    const c = this.hub.campaign();
    if (!c) return;
    this.campaigns.removeMember(c.id, member.id).subscribe({
      next: () => {
        this.hub.error.set(null);
        hooks?.onOk?.();
      },
      error: () => this.hub.error.set('Impossible de retirer ce joueur.'),
    });
  }

  setMemberSpectator(member: CampaignMember, hooks?: CampaignHubSyncHooks): void {
    const c = this.hub.campaign();
    if (!c?.isOwner) return;
    this.campaigns.setMemberSpectator(c.id, member.id).subscribe({
      next: () => {
        this.hub.rosterFeedback.set(`${member.displayName} est maintenant spectateur.`);
        hooks?.onOk?.();
      },
      error: () => this.hub.error.set('Impossible de passer ce membre en spectateur.'),
    });
  }

  applyScheduleRsvp(eventId: string, status: 'yes' | 'no' | 'maybe'): void {
    const c = this.hub.campaign();
    if (!c) return;
    this.campaigns.setScheduleRsvp(c.id, eventId, status).subscribe({
      next: (rsvps) => {
        const mapped = rsvps.map((r) => ({
          userId: r.userId,
          displayName: r.displayName,
          status: r.status as 'yes' | 'no' | 'maybe',
          at: r.at,
        }));
        const next = (c.data.scheduleEvents ?? []).map((e) =>
          e.id === eventId ? { ...e, rsvps: mapped } : e,
        );
        this.hub.campaign.update((cur) =>
          cur ? { ...cur, data: { ...cur.data, scheduleEvents: next } } : cur,
        );
      },
    });
  }

  convertScheduleEventToSession(
    ev: CampaignScheduleEvent,
    scheduledAt: string,
  ): CampaignSession | null {
    const c = this.hub.campaign();
    if (!c?.isOwner) return null;
    this.hub.flushSessionSave();
    const session = plannedSessionFromScheduleEvent(
      ev,
      scheduledAt,
      crypto.randomUUID?.() ?? `session-${Date.now()}`,
    );
    const scheduleEvents = linkScheduleEventToSession(c.data.scheduleEvents ?? [], ev.id, session.id);
    this.hub.saveData({
      sessions: [session, ...(c.data.sessions ?? [])],
      scheduleEvents,
    });

    const memberIds = new Set(
      (c.members ?? []).filter((m) => m.role === 'player').map((m) => m.userId),
    );
    const toInvite = scheduleYesInviteUserIds(ev.rsvps, memberIds);
    const yesAlready = (ev.rsvps ?? []).filter(
      (r) => r.status === 'yes' && memberIds.has(r.userId),
    ).length;
    if (!toInvite.length) {
      this.hub.rosterFeedback.set(scheduleRsvpFeedback(session.title, yesAlready, 0, 0));
      return session;
    }
    let invited = 0;
    let inviteFails = 0;
    for (const userId of toInvite) {
      this.campaigns.invitePlayer(c.id, userId).subscribe({
        next: () => {
          invited++;
          this.markPendingInvite(userId);
          if (invited + inviteFails === toInvite.length) {
            this.hub.rosterFeedback.set(
              scheduleRsvpFeedback(session.title, yesAlready, invited, inviteFails),
            );
          }
        },
        error: () => {
          inviteFails++;
          if (invited + inviteFails === toInvite.length) {
            this.hub.rosterFeedback.set(
              scheduleRsvpFeedback(session.title, yesAlready, invited, inviteFails),
            );
          }
        },
      });
    }
    return session;
  }

  setArchived(archived: boolean): void {
    const c = this.hub.campaign();
    if (!c || c.isHistory || this.hub.archiving()) return;
    this.hub.archiving.set(true);
    this.campaigns.setArchived(c.id, archived).subscribe({
      next: () => {
        this.hub.campaign.update((cur) => (cur ? { ...cur, isArchived: archived } : cur));
        this.hub.archiving.set(false);
        this.hub.syncNotice.set(
          archived
            ? 'Campagne archivée — toujours accessible depuis Archives.'
            : 'Campagne désarchivée — de retour dans Actives.',
        );
        if (this.archiveNoticeTimer) clearTimeout(this.archiveNoticeTimer);
        this.archiveNoticeTimer = setTimeout(() => {
          const n = this.hub.syncNotice();
          if (n?.includes('archiv')) this.hub.syncNotice.set(null);
        }, 4_000);
      },
      error: () => {
        this.hub.archiving.set(false);
        this.hub.error.set(archived ? 'Impossible d’archiver.' : 'Impossible de désarchiver.');
      },
    });
  }

  leaveCampaign(onLeft: () => void): void {
    const c = this.hub.campaign();
    if (!c || c.isOwner || this.hub.leaving()) return;
    this.hub.leaving.set(true);
    this.campaigns.leaveCampaign(c.id).subscribe({
      next: () => {
        this.hub.leaving.set(false);
        onLeft();
      },
      error: () => {
        this.hub.leaving.set(false);
        this.hub.error.set('Impossible de quitter la campagne.');
      },
    });
  }

  deleteCampaign(typedTitle: string, onDeleted: () => void): void {
    const c = this.hub.campaign();
    if (!c?.isOwner || typedTitle.trim() !== c.title.trim() || this.hub.deletingCampaign()) return;
    this.hub.deletingCampaign.set(true);
    this.hub.deleteCampaignError.set(null);
    this.campaigns.delete(c.id).subscribe({
      next: () => {
        this.hub.deletingCampaign.set(false);
        onDeleted();
      },
      error: () => {
        this.hub.deletingCampaign.set(false);
        this.hub.deleteCampaignError.set('Échec de la suppression. Réessayez.');
      },
    });
  }
}
